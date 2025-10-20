import React, { useState } from 'react';
import { Upload, ArrowLeft, Check, AlertCircle, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useEffect } from 'react';
import { initGA, tracking } from './analytics';

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
}

interface Person {
  name: string;
}

interface Receipt {
  id: string;
  items: ReceiptItem[];
  payer: string;
  serviceChargeEnabled: boolean;
  serviceChargePercent: number;
  gstEnabled: boolean;
  gstPercent: number;
  uploadedImage: string;
}

export default function App() {
  useEffect(() => {
    initGA();
    tracking.reachedStep(1);
    setStepsVisited(new Set([1]));
  }, [])
  const [step, setStep] = useState(1);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState('');
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [stepsVisited, setStepsVisited] = useState<Set<number>>(new Set());

  const setStepWithTracking = (newStep: number) => {
    setStep(newStep);
    if (!stepsVisited.has(newStep)) {
      tracking.reachedStep(newStep);
      setStepsVisited(prev => new Set(prev).add(newStep));
    }
  };

  const getCurrentReceipt = (): Receipt => {
    if (receipts[currentReceiptIndex]) {
      return receipts[currentReceiptIndex];
    }
    return {
      id: `receipt-${Date.now()}`,
      items: [],
      payer: '',
      serviceChargeEnabled: false,
      serviceChargePercent: 10,
      gstEnabled: false,
      gstPercent: 9,
      uploadedImage: ''
    };
  };

  const currentReceipt = getCurrentReceipt();

  const updateCurrentReceipt = (updates: Partial<Receipt>) => {
    const newReceipts = [...receipts];
    if (newReceipts[currentReceiptIndex]) {
      newReceipts[currentReceiptIndex] = { ...newReceipts[currentReceiptIndex], ...updates };
    } else {
      newReceipts[currentReceiptIndex] = { ...getCurrentReceipt(), ...updates };
    }
    setReceipts(newReceipts);
  };

  const parseReceiptText = (text: string): ReceiptItem[] => {
    const items: ReceiptItem[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const excludeTerms = [
      'total', 'subtotal', 'tax', 'gst', 'service', 'charge',
      'cash', 'change', 'payment', 'receipt', 'thank', 'survey', 'price'
    ];
    
    const shouldExclude = (text: string): boolean => {
      const lowerText = text.toLowerCase();
      return excludeTerms.some(term => lowerText.includes(term));
    };
    
    const processedIndices = new Set<number>();
    
    lines.forEach((line, index) => {
      if (processedIndices.has(index) || shouldExclude(line)) {
        return;
      }
      
      // Pattern 1: Price on same line - "1 Item Name $ 5.50" or "Item Name 1 $ 21.00"
      const sameLineMatch = line.match(/^(.+?)\s+\$?\s*(\d+\.\d{2})$/);
      if (sameLineMatch) {
        let itemText = sameLineMatch[1].trim();
        const price = parseFloat(sameLineMatch[2]);
        
        // Remove quantity prefix (1, 2, etc.)
        itemText = itemText.replace(/^\d+\s+/, '');
        // Remove trailing $ and numbers
        itemText = itemText.replace(/\s*\d*\s*\$?\s*$/, '').trim();
        // Remove asterisks and plus signs (modifiers)
        itemText = itemText.replace(/^[\*\+\s]+/, '').trim();
        
        if (itemText.length >= 3 && !shouldExclude(itemText) && price > 0 && price < 500) {
          items.push({
            id: `ocr-${Date.now()}-${index}`,
            name: itemText,
            price: price,
            assignedTo: []
          });
          processedIndices.add(index);
          return;
        }
      }
      
      // Pattern 2: Item with quantity prefix (for when price is separate)
      const itemMatch = line.match(/^(\d+)\s+([A-Z][A-Za-z\s&'()]{2,})$/i);
      
      if (itemMatch) {
        let itemName = itemMatch[2].trim();
        
        // Remove trailing $ 
        itemName = itemName.replace(/\$$/, '').trim();
        // Remove asterisks and plus signs
        itemName = itemName.replace(/^[\*\+\s]+/, '').trim();
        
        if (itemName.length < 3 || shouldExclude(itemName)) {
          return;
        }
        
        // Look BACKWARD for price (2-3 lines)
        let foundPrice = null;
        for (let offset = 1; offset <= 3; offset++) {
          const prevIndex = index - offset;
          if (prevIndex < 0) break;
          if (processedIndices.has(prevIndex)) continue;
          
          const prevLine = lines[prevIndex];
          const priceMatch = prevLine.match(/^\$?\s*(\d+\.\d{2})$/);
          
          if (priceMatch) {
            const price = parseFloat(priceMatch[1]);
            if (price > 0 && price < 500) {
              foundPrice = price;
              processedIndices.add(prevIndex);
              break;
            }
          }
        }
        
        // Look FORWARD for price (1-2 lines)
        if (foundPrice === null) {
          for (let offset = 1; offset <= 2; offset++) {
            const nextIndex = index + offset;
            if (nextIndex >= lines.length) break;
            if (processedIndices.has(nextIndex)) continue;
            
            const nextLine = lines[nextIndex];
            const priceMatch = nextLine.match(/^\$?\s*(\d+\.\d{2})$/);
            
            if (priceMatch) {
              const price = parseFloat(priceMatch[1]);
              if (price > 0 && price < 500) {
                foundPrice = price;
                processedIndices.add(nextIndex);
                break;
              }
            }
          }
        }
        
        if (foundPrice !== null) {
          items.push({
            id: `ocr-${Date.now()}-${index}`,
            name: itemName,
            price: foundPrice,
            assignedTo: []
          });
          processedIndices.add(index);
        }
      }
    });
    
    return items;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    setError('');
    setOcrProgress(0);
  
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload JPG or PNG');
      return;
    }
  
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB');
      return;
    }
  
    if (step === 1) {
      setStepWithTracking(2);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    setIsProcessing(true);
    tracking.ocrStarted();
    // After OCR starts
    if (currentReceiptIndex === 0) {
      tracking.firstReceiptOCR();
    } else {
      tracking.additionalReceiptOCR(currentReceiptIndex + 1);
    }

    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1500,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.7
      };
      
      const compressedFile = await imageCompression(file, options);
      
      let finalFile = compressedFile;
      
      if (compressedFile.size > 1000000) {
        const options2 = {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.6
        };
        finalFile = await imageCompression(compressedFile, options2);
      }
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(finalFile);
      });
      
      const originalBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      updateCurrentReceipt({ uploadedImage: originalBase64 });

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData: base64 }),
      });
  
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
  
      const result = await response.json();
      
      if (result.IsErroredOnProcessing) {
        throw new Error(result.ErrorMessage || 'OCR failed');
      }
  
      if (!result.ParsedResults || result.ParsedResults.length === 0) {
        throw new Error('No text found in image');
      }
  
      const extractedText = result.ParsedResults[0].ParsedText;
      console.log('=== RAW OCR OUTPUT ===');
      console.log(extractedText);
      console.log('=== END RAW OUTPUT ===');

      const parsedItems = parseReceiptText(extractedText);
      console.log('=== PARSED ITEMS ===');
      console.log(parsedItems);
      console.log('=== END PARSED ITEMS ===');
  
      if (parsedItems.length === 0) {
        tracking.ocrFailed('No items found');
        setError('No items found. Add manually below.');
        updateCurrentReceipt({ items: [] });
      } else {
        tracking.ocrSuccess(parsedItems.length);
        updateCurrentReceipt({ items: parsedItems });
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      tracking.ocrFailed(errorMsg);
      setError(`OCR failed: ${errorMsg}. Please add items manually.`);
      updateCurrentReceipt({ items: [] });
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };
  
  const addPerson = () => {
    const trimmedName = newPersonName.trim();
    if (!trimmedName) return;
    
    if (people.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Person already exists');
      return;
    }
    
    const newPeople = [...people, { name: trimmedName }];
    setPeople(newPeople);
    tracking.personAdded(newPeople.length);
    setNewPersonName('');
    setError('');
  };

  const removePerson = (name: string) => {
    if (currentReceiptIndex > 0) {
      setError('Cannot remove original party members');
      return;
    }
    
    setPeople(people.filter(p => p.name !== name));
    
    const newReceipts = receipts.map(receipt => ({
      ...receipt,
      items: receipt.items.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(p => p !== name)
      })),
      payer: receipt.payer === name ? '' : receipt.payer
    }));
    setReceipts(newReceipts);
  };

  const addItem = () => {
    tracking.itemAddedManually();
    updateCurrentReceipt({
      items: [...currentReceipt.items, {
        id: `manual-${Date.now()}`,
        name: '',
        price: 0,
        assignedTo: []
      }]
    });
  };

  const updateItem = (id: string, field: 'name' | 'price', value: string | number) => {
    updateCurrentReceipt({
      items: currentReceipt.items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    });
  };

  const deleteItem = (id: string) => {
    tracking.itemDeleted();
    updateCurrentReceipt({
      items: currentReceipt.items.filter(item => item.id !== id)
    });
  };

  const togglePersonAssignment = (itemId: string, personName: string) => {
    updateCurrentReceipt({
      items: currentReceipt.items.map(item => {
        if (item.id !== itemId) return item;
        const isAssigned = item.assignedTo.includes(personName);
        const newAssignedTo = isAssigned
          ? item.assignedTo.filter(p => p !== personName)
          : [...item.assignedTo, personName];
        
        if (!isAssigned) {
          tracking.itemAssigned(newAssignedTo.length);
        }
        
        return {
          ...item,
          assignedTo: newAssignedTo
        };
      })
    });
  };

  const calculateReceiptTotal = (receipt: Receipt): number => {
    const subtotal = receipt.items.reduce((sum, item) => sum + (item.price || 0), 0);
    let total = subtotal;
    
    if (receipt.serviceChargeEnabled) {
      total += subtotal * (receipt.serviceChargePercent / 100);
    }
    
    if (receipt.gstEnabled) {
      const baseAmount = receipt.serviceChargeEnabled 
        ? subtotal * (1 + receipt.serviceChargePercent / 100)
        : subtotal;
      total += baseAmount * (receipt.gstPercent / 100);
    }
    
    return total;
  };

  const validateStep3 = (): boolean => {
    if (!currentReceipt.payer) {
      setError('Please select who paid');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep4 = (): boolean => {
    const unassigned = currentReceipt.items.filter(item => item.assignedTo.length === 0);
    if (unassigned.length > 0) {
      setError(`Assign people to: ${unassigned.map(i => i.name).join(', ')}`);
      return false;
    }
    setError('');
    return true;
  };

  const getPeopleWithNoItems = (): string[] => {
    return people
      .filter(p => !currentReceipt.items.some(item => item.assignedTo.includes(p.name)))
      .map(p => p.name);
  };

  const addAnotherReceipt = () => {
    if (receipts.length >= 3) {
      setError('Maximum of 3 receipts supported');
      return;
    }
    
    tracking.receiptAdded(receipts.length + 1);
    setCurrentReceiptIndex(receipts.length);
    setStepWithTracking(2);
    setError('');
  };

  const navigateToReceipt = (index: number) => {
    setCurrentReceiptIndex(index);
    setStepWithTracking(2);
    setError('');
  };

  const generateSummaryText = (): string => {
    const personConsumption: { [name: string]: number } = {};
    people.forEach(person => {
      personConsumption[person.name] = 0;
    });

    receipts.forEach(receipt => {
      receipt.items.forEach(item => {
        item.assignedTo.forEach(personName => {
          const shareAmount = item.price / item.assignedTo.length;
          personConsumption[personName] += shareAmount;
        });
      });

      people.forEach(person => {
        let personSubtotal = 0;
        receipt.items.forEach(item => {
          if (item.assignedTo.includes(person.name)) {
            const shareAmount = item.price / item.assignedTo.length;
            personSubtotal += shareAmount;
          }
        });

        if (receipt.serviceChargeEnabled) {
          personConsumption[person.name] += personSubtotal * (receipt.serviceChargePercent / 100);
        }

        if (receipt.gstEnabled) {
          const scAmount = receipt.serviceChargeEnabled 
            ? personSubtotal * (receipt.serviceChargePercent / 100) 
            : 0;
          personConsumption[person.name] += (personSubtotal + scAmount) * (receipt.gstPercent / 100);
        }
      });
    });

    const personPaid: { [name: string]: number } = {};
    people.forEach(person => {
      personPaid[person.name] = 0;
    });

    receipts.forEach(receipt => {
      if (receipt.payer) {
        personPaid[receipt.payer] += calculateReceiptTotal(receipt);
      }
    });

    const netPositions: { [name: string]: number } = {};
    people.forEach(person => {
      netPositions[person.name] = personPaid[person.name] - personConsumption[person.name];
    });

    const creditors = people.filter(p => netPositions[p.name] > 0.01)
      .map(p => ({ name: p.name, amount: netPositions[p.name] }))
      .sort((a, b) => b.amount - a.amount);
    
    const debtors = people.filter(p => netPositions[p.name] < -0.01)
      .map(p => ({ name: p.name, amount: -netPositions[p.name] }))
      .sort((a, b) => b.amount - a.amount);

    const transfers: { from: string; to: string; amount: number }[] = [];
    
    const creditorsCopy = creditors.map(c => ({ ...c }));
    const debtorsCopy = debtors.map(d => ({ ...d }));

    debtorsCopy.forEach(debtor => {
      let remaining = debtor.amount;
      
      for (const creditor of creditorsCopy) {
        if (remaining < 0.01) break;
        if (creditor.amount < 0.01) continue;

        const transferAmount = Math.min(remaining, creditor.amount);
        transfers.push({
          from: debtor.name,
          to: creditor.name,
          amount: transferAmount
        });

        remaining -= transferAmount;
        creditor.amount -= transferAmount;
      }
    });

    let summary = '💰 Payment Summary:\n';
    
    if (transfers.length === 0) {
      summary += '\nAll settled! No transfers needed.\n';
    } else {
      transfers.forEach(t => {
        summary += `${t.from} → ${t.to}: $${t.amount.toFixed(2)}\n`;
      });
    }

    summary += '\n💳 Payments Made:\n';
    people.forEach(person => {
      if (personPaid[person.name] > 0) {
        summary += `${person.name} paid $${personPaid[person.name].toFixed(2)}\n`;
      }
    });

    summary += '\n📋 Breakdown by Receipt:\n';
    
    receipts.forEach((receipt, receiptIndex) => {
      summary += `\n[Receipt ${receiptIndex + 1}]\n`;
      
      people.forEach(person => {
        const personItems: { name: string; amount: number; percentage?: number }[] = [];
        let personSubtotal = 0;

        receipt.items.forEach(item => {
          if (item.assignedTo.includes(person.name)) {
            const shareCount = item.assignedTo.length;
            const shareAmount = item.price / shareCount;
            personSubtotal += shareAmount;

            personItems.push({
              name: item.name,
              amount: shareAmount,
              percentage: shareCount > 1 ? Math.round(100 / shareCount) : undefined
            });
          }
        });

        if (personItems.length === 0) return;

        let line = `${person.name}: `;
        
        personItems.forEach((item, idx) => {
          if (idx > 0) line += ', ';
          line += `${item.name} ($${item.amount.toFixed(2)}`;
          if (item.percentage) {
            const numPeople = Math.round(100 / item.percentage);
            const splitText = numPeople === 2 ? 'split between two' : `split among ${numPeople}`;
            line += ` - ${splitText}`;
          }
          line += ')';
        });

        let personSc = 0;
        let personGst = 0;

        if (receipt.serviceChargeEnabled) {
          personSc = personSubtotal * (receipt.serviceChargePercent / 100);
        }

        if (receipt.gstEnabled) {
          personGst = (personSubtotal + personSc) * (receipt.gstPercent / 100);
        }

        if (personSc > 0 || personGst > 0) {
          line += `, SC+GST ($${(personSc + personGst).toFixed(2)})`;
        }

        const personTotal = personSubtotal + personSc + personGst;
        line += ` = $${personTotal.toFixed(2)}`;
        summary += line + '\n';
      });

      summary += `Receipt ${receiptIndex + 1} Total: $${calculateReceiptTotal(receipt).toFixed(2)}\n`;
    });

    summary += '\n---\nGenerated by Pay How Much Ah, a web app by Manish Nair. Use it to split the cost at https://pay-how-much-ah.vercel.app';
    
    return summary;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateSummaryText());
    tracking.summaryCopied();
    setShowCopyConfirm(true);
    setTimeout(() => setShowCopyConfirm(false), 2000);
  };

  const getReceiptIndicator = (): string => {
    if (receipts.length === 0) return '';
    
    const currentReceiptExists = receipts[currentReceiptIndex] !== undefined;
    
    if (!currentReceiptExists) {
      return `Receipt ${currentReceiptIndex + 1}`;
    }
    
    if (receipts.length === 1) return 'Receipt 1';
    return `Receipt ${currentReceiptIndex + 1} of ${receipts.length}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 
            className="text-4xl font-bold text-gray-900 mb-2 cursor-pointer hover:text-gray-700 transition"
            onClick={() => {
              if (window.confirm('Start over? This will clear all data.')) {
                tracking.startedOver();
                setStep(1);
                setReceipts([]);
                setCurrentReceiptIndex(0);
                setPeople([]);
                setNewPersonName('');
                setIsProcessing(false);
                setOcrProgress(0);
                setError('');
                setShowCopyConfirm(false);
              }
            }}
          >
            Pay How Much Ah?
          </h1>
          <p className="text-gray-600">Split the cost easily - up to 3 receipts</p>
        </div>
        
        <div className="flex justify-between mb-8">
          {[1, 2, 3, 4, 5].map(num => (
            <div
              key={num}
              className={`flex-1 h-2 mx-1 rounded-full transition ${
                num <= step ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {receipts.length > 0 && step >= 2 && step <= 4 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              {getReceiptIndicator()}
            </div>
            {receipts.length > 1 && (
              <div className="flex gap-2">
                {receipts.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => navigateToReceipt(idx)}
                    className={`px-3 py-1 text-sm rounded ${
                      idx === currentReceiptIndex
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    R{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="bg-white rounded-xl shadow-sm p-6">
          {step === 1 && (
            <div className="text-center py-12">
              <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-2xl font-semibold mb-4">Upload Your Receipt</h2>
              <p className="text-gray-600 mb-2">JPG or PNG (max 10MB)</p>
              <p className="text-sm text-gray-500 mb-6">📸 Clear photo = better results</p>
              
              <div className="flex flex-col gap-3 items-center">
                <label className="px-6 py-3 bg-gray-900 text-white rounded-lg cursor-pointer hover:bg-gray-800 transition">
                  Upload & Scan Receipt
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                
                <button
                    onClick={() => {
                      if (currentReceiptIndex === 0) {
                        tracking.firstReceiptManual();
                      }
                      tracking.skippedOCR();
                      setStepWithTracking(2);
                    }}
                    className="px-6 py-3 text-gray-700 border rounded-lg hover:bg-gray-50 transition"
                >
                  Skip - Enter Manually
                </button>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 justify-center">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {isProcessing ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Reading receipt...</p>
                  <p className="text-sm text-gray-500 mt-2">Using a free OCR service -- up to 10 seconds</p>
                  {ocrProgress > 0 && (
                    <div className="mt-4 max-w-xs mx-auto">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gray-900 h-2 rounded-full transition-all"
                          style={{ width: `${ocrProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{ocrProgress}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {currentReceiptIndex > 0 && (
                    <div className="mb-4">
                      <label className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition flex items-center justify-center gap-2">
                        <Upload className="w-5 h-5" />
                        Upload Receipt {currentReceiptIndex + 1}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  {currentReceipt.uploadedImage && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Receipt:</p>
                      <img src={currentReceipt.uploadedImage} alt="Receipt" className="max-h-40 mx-auto rounded border" />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold">Items</h3>
                      {currentReceipt.items.length === 0 && <span className="text-sm text-gray-500">Add manually</span>}
                    </div>
                    <div className="space-y-2">
                      {currentReceipt.items.map(item => (
                        <div key={item.id} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            placeholder="Item name"
                            className="flex-1 min-w-0 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-900"
                          />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-gray-600">$</span>
                            <input
                              type="number"
                              value={item.price || ''}
                              onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                  updateItem(item.id, 'price', parseFloat(val.toFixed(2)));
                                  e.target.value = val.toFixed(2);
                                } else if (e.target.value === '' || val === 0) {
                                  updateItem(item.id, 'price', 0);
                                }
                              }}
                              placeholder="0.00"
                              step="0.01"
                              className="w-20 px-2 py-2 border rounded-lg focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            aria-label="Delete item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addItem}
                      className="mt-3 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Party Members</h3>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addPerson()}
                        placeholder="Name"
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-900"
                      />
                      <button
                        onClick={addPerson}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {people.map(person => (
                        <div key={person.name} className="px-3 py-1 bg-gray-100 rounded-full flex items-center gap-2">
                          <span>{person.name}</span>
                          {currentReceiptIndex === 0 && (
                            <button
                              onClick={() => removePerson(person.name)}
                              className="text-gray-600 hover:text-red-600"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {currentReceiptIndex > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Original members cannot be removed. You can add new members.
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-3">Service Charge & GST</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sc"
                          checked={currentReceipt.serviceChargeEnabled}
                          onChange={(e) => {
                            updateCurrentReceipt({ serviceChargeEnabled: e.target.checked });
                            tracking.serviceChargeToggled(e.target.checked);
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor="sc" className="flex-1">Service Charge</label>
                        <input
                          type="number"
                          value={currentReceipt.serviceChargePercent}
                          onChange={(e) => updateCurrentReceipt({ serviceChargePercent: parseFloat(e.target.value) || 0 })}
                          disabled={!currentReceipt.serviceChargeEnabled}
                          className="w-20 px-3 py-1 border rounded-lg disabled:bg-gray-100"
                        />
                        <span>%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="gst"
                          checked={currentReceipt.gstEnabled}
                          onChange={(e) => {
                            updateCurrentReceipt({ gstEnabled: e.target.checked });
                            tracking.gstToggled(e.target.checked);
                          }}
                          className="w-4 h-4"
                        />
                        <label htmlFor="gst" className="flex-1">GST</label>
                        <input
                          type="number"
                          value={currentReceipt.gstPercent}
                          onChange={(e) => updateCurrentReceipt({ gstPercent: parseFloat(e.target.value) || 0 })}
                          disabled={!currentReceipt.gstEnabled}
                          className="w-20 px-3 py-1 border rounded-lg disabled:bg-gray-100"
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Receipt Total</span>
                      <span>${calculateReceiptTotal(currentReceipt).toFixed(2)}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (people.length === 0) {
                        setError('Add at least one person');
                        return;
                      }
                      if (currentReceipt.items.length === 0) {
                        setError('Add at least one item');
                        return;
                      }
                      setError('');
                      
                      // Track completion of first receipt
                      if (currentReceiptIndex === 0) {
                        tracking.completedFirstReceipt();
                      }
                      
                      updateCurrentReceipt({ payer: currentReceipt.payer });
                      setStepWithTracking(3);
                    }}
                    className="w-full px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    Next: Select Payer
                  </button>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Who Paid?</h2>
              <div className="space-y-2">
                {people.map(person => (
                  <button
                    key={person.name}
                    onClick={() => updateCurrentReceipt({ payer: person.name })}
                    className={`w-full px-4 py-3 border-2 rounded-lg transition ${
                      currentReceipt.payer === person.name ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStepWithTracking(2)} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => validateStep3() && setStepWithTracking(4)}
                  className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Next: Assign Items
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Assign Items</h2>
              <div className="space-y-4">
                {currentReceipt.items.map(item => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between mb-3">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-600">${item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {people.map(person => (
                        <button
                          key={person.name}
                          onClick={() => togglePersonAssignment(item.id, person.name)}
                          className={`px-3 py-1 rounded-full text-sm transition ${
                            item.assignedTo.includes(person.name)
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {person.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {getPeopleWithNoItems().length > 0 && (
                <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">No items:</p>
                    <p>{getPeopleWithNoItems().join(', ')}</p>
                  </div>
                </div>
              )}
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStepWithTracking(3)} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                  Back
                </button>
                <div className="flex-1 flex gap-3">
                  {receipts.length < 3 && (
                    <button
                      onClick={() => {
                        if (!validateStep4()) return;
                        addAnotherReceipt();
                      }}
                      className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
                    >
                      + Another Receipt
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (validateStep4()) {
                        const totalAmount = calculateReceiptTotal(currentReceipt);
                        tracking.summaryGenerated(receipts.length, totalAmount);
                        setStepWithTracking(5);
                      }
                    }}                    
                    className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    Generate Summary
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Summary</h2>
              <div className="bg-gray-50 p-6 rounded-lg font-mono text-sm whitespace-pre-wrap">
                {generateSummaryText()}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStepWithTracking(4)}
                  className="px-6 py-3 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2"
                >
                  {showCopyConfirm ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    'Copy to Clipboard'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}