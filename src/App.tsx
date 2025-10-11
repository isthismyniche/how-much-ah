import React, { useState } from 'react';
import { Upload, ArrowLeft, Check, AlertCircle, Trash2 } from 'lucide-react';

// OCR.space API key - replace with your own from https://ocr.space/ocrapi
const OCR_API_KEY = 'K84997741488957';  // ← PUT YOUR API KEY HERE

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  assignedTo: string[];
}

interface Person {
  name: string;
}

interface PersonCalculation {
  name: string;
  subtotal: number;
  scAmount: number;
  gstAmount: number;
  total: number;
  items: { name: string; amount: number; percentage?: number }[];
}

export default function App() {
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState(10);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstPercent, setGstPercent] = useState(9);
  const [payer, setPayer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [error, setError] = useState('');
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

  const parseReceiptText = (text: string): ReceiptItem[] => {
    const items: ReceiptItem[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('🔍 Parsing lines:', lines);
    
    const excludeTerms = [
      'total', 'subtotal', 'tax', 'gst', 'service', 'charge', 'svr', 'chrg',
      'cash', 'change', 'payment', 'tender', 'receipt', 'thank', 'welcome',
      'invoice', 'bill', 'discount', 'pos', 'table', 'cashier', 'station',
      'quay', 'robertson', 'buayside', 'guayside', 'rept', 'pax', 'april', 'date'
    ];
    
    const shouldExclude = (text: string): boolean => {
      const lowerText = text.toLowerCase();
      return excludeTerms.some(term => lowerText.includes(term));
    };
    
    lines.forEach((line, index) => {
      if (line.length < 2) return;
      
      console.log(`\nLine ${index}: "${line}"`);
      
      if (shouldExclude(line)) {
        console.log(`  ❌ Excluded (matches exclude term)`);
        return;
      }
      
      // Find all prices in line
      const priceMatches = line.match(/\$?\d+\.\d{2}/g);
      
      let bestPrice = null;
      let bestPriceValue = 0;
      
      if (priceMatches) {
        // Take the last price (usually the item total)
        for (let i = priceMatches.length - 1; i >= 0; i--) {
          const price = parseFloat(priceMatches[i].replace('$', ''));
          if (price > 0 && price < 1000) {
            bestPrice = priceMatches[i];
            bestPriceValue = price;
            console.log(`  💰 Price: $${price.toFixed(2)}`);
            break;
          }
        }
      }
      
      // Extract potential item name
      let itemName = line;
      
      // Remove prices
      if (priceMatches) {
        priceMatches.forEach(p => itemName = itemName.replace(p, ''));
      }
      
      // Clean up the name
      itemName = itemName.replace(/^\d+\s+/, '');        // Remove "1 " prefix
      itemName = itemName.replace(/^\d+\.\s*/, '');      // Remove "1." prefix
      itemName = itemName.replace(/^[\*\-\+\#]+\s*/, ''); // Remove symbols
      itemName = itemName.replace(/\+{2,}/g, '');        // Remove "+++"
      itemName = itemName.replace(/\.{2,}/g, '');        // Remove "...."
      itemName = itemName.replace(/\s+/g, ' ').trim();   // Clean spaces
      
      // Check if this is a standalone price line
      const isStandalonePriceLine = /^\$?\d+\.\d{2}$/.test(line.trim());
      
      // Check if line starts with a quantity number (strong indicator of an item)
      const startsWithQuantity = /^\d+\s+[A-Z]/.test(line);
      
      let shouldAdd = false;
      let finalName = '';
      let finalPrice = 0;
      let reason = '';
      
      // PRIORITY 1: Line has quantity + name + price
      if (startsWithQuantity && itemName.length >= 2 && bestPrice && bestPriceValue > 0) {
        shouldAdd = true;
        finalName = itemName;
        finalPrice = bestPriceValue;
        reason = 'Qty + Name + Price';
      }
      // PRIORITY 2: Line has name + price (no quantity, but has both)
      else if (!startsWithQuantity && itemName.length >= 3 && bestPrice && bestPriceValue > 0 && !shouldExclude(itemName)) {
        shouldAdd = true;
        finalName = itemName;
        finalPrice = bestPriceValue;
        reason = 'Name + Price';
      }
      // PRIORITY 3: Standalone price (just "$12.00" on its own line)
      else if (isStandalonePriceLine && bestPriceValue > 0 && bestPriceValue < 100) {
        shouldAdd = true;
        finalName = 'Item';
        finalPrice = bestPriceValue;
        reason = 'Standalone price';
      }
      // PRIORITY 4: Line starts with quantity + has name (add with $0.00)
      else if (startsWithQuantity && itemName.length >= 2 && !shouldExclude(itemName)) {
        shouldAdd = true;
        finalName = itemName;
        finalPrice = bestPriceValue || 0;
        reason = 'Qty + Name (no price)';
      }
      
      if (shouldAdd) {
        // Check duplicates
        const isDuplicate = items.some(item => 
          item.name.toLowerCase() === finalName.toLowerCase() &&
          Math.abs(item.price - finalPrice) < 0.01
        );
        
        if (isDuplicate) {
          console.log(`  ⚠️ Duplicate`);
          return;
        }
        
        console.log(`  ✅ ${reason}: "${finalName}" - $${finalPrice.toFixed(2)}`);
        items.push({
          id: `ocr-${Date.now()}-${index}`,
          name: finalName,
          price: finalPrice,
          assignedTo: []
        });
      } else {
        console.log(`  ❌ Not an item`);
      }
    });
    
    console.log(`\n📊 Total items: ${items.length}`);
    return items;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setOcrProgress(0);

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload JPG or PNG');
      return;
    }

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB');
      return;
    }

    // Create image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsProcessing(true);

    try {
      console.log('Starting OCR with OCR.space...');
      
      // Prepare form data for OCR.space API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('apikey', OCR_API_KEY);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Engine 2 is better for receipts
      formData.append('isTable', 'true'); // ← ADD THIS: Enable table/column detection

      // Call OCR.space API
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      console.log('OCR.space result:', result);

      if (result.IsErroredOnProcessing) {
        throw new Error(result.ErrorMessage || 'OCR failed');
      }

      if (!result.ParsedResults || result.ParsedResults.length === 0) {
        throw new Error('No text found in image');
      }

      const extractedText = result.ParsedResults[0].ParsedText;
      console.log('📝 OCR Text:', extractedText);

      // Parse the text
      const parsedItems = parseReceiptText(extractedText);

      if (parsedItems.length === 0) {
        setError('No items found. Add manually below.');
        setItems([]);
      } else {
        setItems(parsedItems);
      }
      
      setStep(2);
      
    } catch (err) {
      console.error('OCR Error:', err);
      setError('OCR failed. Please add items manually.');
      setItems([]);
      setStep(2);
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
    
    setPeople([...people, { name: trimmedName }]);
    setNewPersonName('');
    setError('');
  };

  const removePerson = (name: string) => {
    setPeople(people.filter(p => p.name !== name));
    setItems(items.map(item => ({
      ...item,
      assignedTo: item.assignedTo.filter(p => p !== name)
    })));
    if (payer === name) setPayer('');
  };

  const addItem = () => {
    setItems([...items, {
      id: `manual-${Date.now()}`,
      name: '',
      price: 0,
      assignedTo: []
    }]);
  };

  const updateItem = (id: string, field: 'name' | 'price', value: string | number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const togglePersonAssignment = (itemId: string, personName: string) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const isAssigned = item.assignedTo.includes(personName);
      return {
        ...item,
        assignedTo: isAssigned
          ? item.assignedTo.filter(p => p !== personName)
          : [...item.assignedTo, personName]
      };
    }));
  };

  const calculateGrandTotal = (): number => {
    const subtotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
    let total = subtotal;
    
    if (serviceChargeEnabled) {
      total += subtotal * (serviceChargePercent / 100);
    }
    
    if (gstEnabled) {
      const baseAmount = serviceChargeEnabled 
        ? subtotal * (1 + serviceChargePercent / 100)
        : subtotal;
      total += baseAmount * (gstPercent / 100);
    }
    
    return total;
  };

  const calculatePersonTotals = (): PersonCalculation[] => {
    const calculations = people.map(person => {
      let subtotal = 0;
      const personItems: { name: string; amount: number; percentage?: number }[] = [];
      
      items.forEach(item => {
        if (item.assignedTo.includes(person.name)) {
          const shareCount = item.assignedTo.length;
          const shareAmount = item.price / shareCount;
          subtotal += shareAmount;
          
          personItems.push({
            name: item.name,
            amount: shareAmount,
            percentage: shareCount > 1 ? Math.round(100 / shareCount) : undefined
          });
        }
      });
      
      let scAmount = 0;
      let gstAmount = 0;
      
      if (serviceChargeEnabled) {
        scAmount = subtotal * (serviceChargePercent / 100);
      }
      
      if (gstEnabled) {
        gstAmount = (subtotal + scAmount) * (gstPercent / 100);
      }
      
      return {
        name: person.name,
        subtotal,
        scAmount,
        gstAmount,
        total: subtotal + scAmount + gstAmount,
        items: personItems
      };
    });

    const diff = calculateGrandTotal() - calculations.reduce((s, c) => s + c.total, 0);
    if (Math.abs(diff) > 0.01 && payer) {
      const payerCalc = calculations.find(c => c.name === payer);
      if (payerCalc) payerCalc.total += diff;
    }

    return calculations;
  };

  const validateStep3 = (): boolean => {
    if (!payer) {
      setError('Please select who paid');
      return false;
    }
    setError('');
    return true;
  };

  const validateStep4 = (): boolean => {
    const unassigned = items.filter(item => item.assignedTo.length === 0);
    if (unassigned.length > 0) {
      setError(`Assign people to: ${unassigned.map(i => i.name).join(', ')}`);
      return false;
    }
    setError('');
    return true;
  };

  const getPeopleWithNoItems = (): string[] => {
    return people
      .filter(p => !items.some(item => item.assignedTo.includes(p.name)))
      .map(p => p.name);
  };

  const generateSummaryText = (): string => {
    const calculations = calculatePersonTotals();
    const grandTotal = calculateGrandTotal();
    
    let summary = '💰 Payment Summary:\n';
    summary += `${payer} paid $${grandTotal.toFixed(2)} for the party.\n`;
    
    calculations.forEach(calc => {
      if (calc.name !== payer && calc.total > 0) {
        summary += `- ${calc.name} → ${payer}: $${calc.total.toFixed(2)}\n`;
      }
    });
    
    summary += '\n📋 Breakdown:\n';
    
    calculations.forEach(calc => {
      let line = `${calc.name}: `;
      
      calc.items.forEach((item, idx) => {
        if (idx > 0) line += ', ';
        if (item.percentage) {
          line += `${item.percentage}% ${item.name} ($${item.amount.toFixed(2)})`;
        } else {
          line += `${item.name} ($${item.amount.toFixed(2)})`;
        }
      });
      
      if (calc.scAmount > 0 || calc.gstAmount > 0) {
        line += `, SC+GST ($${(calc.scAmount + calc.gstAmount).toFixed(2)})`;
      }
      
      line += ` = $${calc.total.toFixed(2)}`;
      summary += line + '\n';
    });
    
    return summary;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateSummaryText());
    setShowCopyConfirm(true);
    setTimeout(() => setShowCopyConfirm(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">How Much Ah?</h1>
          <p className="text-gray-600">Split your receipt easily</p>
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
                  onClick={() => setStep(2)}
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
                  <p className="text-sm text-gray-500 mt-2">Using Sparse Text mode - Up to 10 seconds</p>
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
                  {uploadedImage && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Receipt:</p>
                      <img src={uploadedImage} alt="Receipt" className="max-h-40 mx-auto rounded border" />
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold">Items</h3>
                      {items.length === 0 && <span className="text-sm text-gray-500">Add manually</span>}
                    </div>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.id} className="flex gap-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            placeholder="Item name"
                            className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-900"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600">$</span>
                            <input
                              type="number"
                              value={item.price ? item.price.toFixed(2) : '0.00'}
                              onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              step="0.01"
                              className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-900"
                            />
                          </div>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
                          <button
                            onClick={() => removePerson(person.name)}
                            className="text-gray-600 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-3">Service Charge & GST</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="sc"
                          checked={serviceChargeEnabled}
                          onChange={(e) => setServiceChargeEnabled(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="sc" className="flex-1">Service Charge</label>
                        <input
                          type="number"
                          value={serviceChargePercent}
                          onChange={(e) => setServiceChargePercent(parseFloat(e.target.value) || 0)}
                          disabled={!serviceChargeEnabled}
                          className="w-20 px-3 py-1 border rounded-lg disabled:bg-gray-100"
                        />
                        <span>%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="gst"
                          checked={gstEnabled}
                          onChange={(e) => setGstEnabled(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <label htmlFor="gst" className="flex-1">GST</label>
                        <input
                          type="number"
                          value={gstPercent}
                          onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                          disabled={!gstEnabled}
                          className="w-20 px-3 py-1 border rounded-lg disabled:bg-gray-100"
                        />
                        <span>%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span>${calculateGrandTotal().toFixed(2)}</span>
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
                      if (items.length === 0) {
                        setError('Add at least one item');
                        return;
                      }
                      setError('');
                      setStep(3);
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
                    onClick={() => setPayer(person.name)}
                    className={`w-full px-4 py-3 border-2 rounded-lg transition ${
                      payer === person.name ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
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
                <button onClick={() => setStep(2)} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => validateStep3() && setStep(4)}
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
                {items.map(item => (
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
                <button onClick={() => setStep(3)} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={() => validateStep4() && setStep(5)}
                  className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                >
                  Generate Summary
                </button>
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
                  onClick={() => setStep(4)}
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