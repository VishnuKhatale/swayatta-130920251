import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { ArrowLeft, Save, Target } from 'lucide-react';

const OpportunityStageManagement = () => {
  const { opportunityId } = useParams();
  const navigate = useNavigate();
  
  // Core state
  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form data for current stage
  const [stageData, setStageData] = useState({
    project_title: '',
    project_description: '',
    estimated_revenue: '',
    expected_closure_date: '',
    probability: ''
  });

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
  };

  // Stage configuration - simplified
  const stageConfig = {
    name: 'L1 - Prospect',
    description: 'Initial opportunity identification and basic qualification',
    fields: [
      { key: 'project_title', label: 'Project Title', type: 'text', required: true },
      { key: 'project_description', label: 'Project Description', type: 'text', required: true },
      { key: 'estimated_revenue', label: 'Estimated Revenue', type: 'number', required: true },
      { key: 'expected_closure_date', label: 'Expected Closure Date', type: 'date', required: true },
      { key: 'probability', label: 'Success Probability (%)', type: 'number', required: true }
    ]
  };

  // Load opportunity data
  useEffect(() => {
    if (opportunityId) {
      loadOpportunity();
    }
  }, [opportunityId]);

  const loadOpportunity = async () => {
    try {
      setLoading(true);
      console.log('Loading opportunity:', opportunityId);
      setOpportunity({ id: opportunityId, project_title: 'Sample Opportunity' });
    } catch (error) {
      console.error('Error loading opportunity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setStageData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveStageData = async () => {
    try {
      setSaving(true);
      console.log('Saving stage data:', stageData);
      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error saving stage data:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
            <Button
              variant="ghost"
              onClick={() => navigate('/enhanced-opportunities')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </Button>
            <div className="text-sm text-gray-600">
              <span>Opportunities</span>
              <span className="mx-2">/</span>
              <span className="font-medium text-gray-900">{opportunity?.project_title || 'Loading...'}</span>
              <span className="mx-2">/</span>
              <span className="font-medium text-blue-600">Stages</span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            ID: {opportunityId}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader className="pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">{stageConfig.name}</CardTitle>
                <p className="text-gray-600 mt-1">{stageConfig.description}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stageConfig.fields.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={field.key} className="flex items-center">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <div className="mt-1">
                    <Input
                      id={field.key}
                      type={field.type}
                      value={stageData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end pt-6 border-t border-gray-200">
              <Button
                onClick={saveStageData}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Stage'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OpportunityStageManagement;