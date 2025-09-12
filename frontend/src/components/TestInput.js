import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';

const TestInput = () => {
  const [testValue, setTestValue] = useState('');
  const [debugInfo, setDebugInfo] = useState([]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setTestValue(newValue);
    setDebugInfo(prev => [...prev, `onChange: ${newValue}`]);
    console.log('Test input onChange:', newValue);
  };

  const handleInput = (e) => {
    const newValue = e.target.value;
    setDebugInfo(prev => [...prev, `onInput: ${newValue}`]);
    console.log('Test input onInput:', newValue);
  };

  const handleKeyDown = (e) => {
    setDebugInfo(prev => [...prev, `onKeyDown: ${e.key}`]);
    console.log('Test input onKeyDown:', e.key);
  };

  const clearDebug = () => {
    setDebugInfo([]);
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Input Testing Component</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Test Input Field:</label>
          <Input
            type="text"
            value={testValue}
            onChange={handleChange}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Try typing here..."
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Current Value:</label>
          <div className="p-2 bg-gray-100 rounded border">
            {testValue || '(empty)'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Event Log:</label>
          <div className="p-2 bg-gray-50 rounded border max-h-40 overflow-y-auto">
            {debugInfo.length === 0 ? (
              <div className="text-gray-500">No events yet</div>
            ) : (
              debugInfo.map((info, index) => (
                <div key={index} className="text-sm font-mono">
                  {info}
                </div>
              ))
            )}
          </div>
        </div>

        <Button onClick={clearDebug} variant="outline">
          Clear Debug Log
        </Button>
      </div>
    </div>
  );
};

export default TestInput;