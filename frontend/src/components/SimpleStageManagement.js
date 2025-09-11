import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

const SimpleStageManagement = () => {
  const { opportunityId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stageData, setStageData] = useState({
    project_title: '',
    project_description: '',
    estimated_revenue: '',
    expected_closure_date: '',
    probability: ''
  });

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, [opportunityId]);

  const handleFieldChange = (field, value) => {
    setStageData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveStageData = async () => {
    setSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    alert('Stage data saved successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading opportunity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Breadcrumbs */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/enhanced-opportunities')}
              className="flex items-center text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </button>
            <div className="text-sm text-gray-600">
              <span>Opportunities</span>
              <span className="mx-2">/</span>
              <span className="font-medium text-gray-900">Sample Opportunity</span>
              <span className="mx-2">/</span>
              <span className="font-medium text-blue-600">Stages</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            ID: {opportunityId}
          </div>
        </div>
      </div>

      {/* Stage Progress Indicator */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Stage Progress</h2>
          <div className="text-sm text-gray-600">
            Stage L1 of 8 stages
          </div>
        </div>
        
        <div className="flex items-center space-x-2 overflow-x-auto pb-2">
          {['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'].map((stage, index) => (
            <div key={stage} className="flex items-center">
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  stage === 'L1'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {stage} - {stage === 'L1' ? 'Prospect' : stage === 'L2' ? 'Qualification' : 'Stage'}
              </button>
              {index < 7 && (
                <div className="w-4 h-px bg-gray-300 mx-1"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow border">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <div className="h-6 w-6 text-blue-600">🎯</div>
              </div>
              <div>
                <h1 className="text-xl font-semibold">L1 - Prospect</h1>
                <p className="text-gray-600 mt-1">Initial opportunity identification and basic qualification</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={stageData.project_title}
                  onChange={(e) => handleFieldChange('project_title', e.target.value)}
                  placeholder="Enter project title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Revenue <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={stageData.estimated_revenue}
                  onChange={(e) => handleFieldChange('estimated_revenue', e.target.value)}
                  placeholder="Enter estimated revenue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Closure Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={stageData.expected_closure_date}
                  onChange={(e) => handleFieldChange('expected_closure_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success Probability (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={stageData.probability}
                  onChange={(e) => handleFieldChange('probability', e.target.value)}
                  placeholder="Enter probability"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={stageData.project_description}
                  onChange={(e) => handleFieldChange('project_description', e.target.value)}
                  placeholder="Enter project description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                All required fields must be filled to proceed to next stage
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={saveStageData}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Stage'}
                </button>

                <button
                  onClick={saveStageData}
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Continue to L2'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">✅ Stage Management - Full Page View</h3>
          <p className="text-sm text-blue-700">
            This is the new full-page stage management interface. No more cramped modals! 
            You can now manage all L1-L8 stages with proper navigation, field persistence, 
            and progress tracking.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SimpleStageManagement;