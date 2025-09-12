import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  DollarSign,
  FileText,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
  AlertTriangle,
  Package,
  Clock,
  RefreshCw
} from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';

const ServiceDeliveryDetails = () => {
  const { sdrId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  // API Base URL
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // Auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Load review details
  useEffect(() => {
    loadReviewDetails();
  }, [sdrId]);

  const loadReviewDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/upcoming/${sdrId}/details`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setReviewData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading review details:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Action handlers
  const handleConvertToProject = async () => {
    if (!window.confirm('Are you sure you want to convert this to an active project? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, convert: true }));
      const response = await axios.post(`${API_BASE_URL}/api/service-delivery/upcoming/${sdrId}/convert`, {}, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Project converted successfully! Delivery tracking has begun."
        });
        navigate('/service-delivery?tab=projects');
      }
    } catch (error) {
      console.error('Error converting project:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to convert project';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, convert: false }));
    }
  };

  const handleRejectOpportunity = async () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    if (!window.confirm('Are you sure you want to reject this opportunity? This will close the Service Delivery request.')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, reject: true }));
      const response = await axios.post(`${API_BASE_URL}/api/service-delivery/upcoming/${sdrId}/reject`, {
        remarks: reason
      }, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        toast.success('Opportunity rejected successfully');
        navigate('/service-delivery?tab=upcoming');
      }
    } catch (error) {
      console.error('Error rejecting opportunity:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to reject opportunity';
      toast.error(errorMessage);
    } finally {
      setActionLoading(prev => ({ ...prev, reject: false }));
    }
  };

  // Render functions
  const renderOpportunityTab = () => {
    const { sdr, opportunity, lead } = reviewData;
    
    return (
      <div className="space-y-6">
        {/* SDR Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Service Delivery Request Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">SDR ID</label>
                <p className="text-lg font-semibold">{sdr?.sd_request_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge className={
                  sdr?.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                  sdr?.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }>
                  {sdr?.approval_status}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Project Value</label>
                <p className="text-lg font-semibold">${sdr?.project_value?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Details */}
        {opportunity && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Opportunity Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Opportunity Title</label>
                  <p className="font-medium">{opportunity.opportunity_title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Current Stage</label>
                  <Badge>{opportunity.current_stage_name || opportunity.current_stage_id}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Company</label>
                  <p>{opportunity.company_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Estimated Value</label>
                  <p>${opportunity.estimated_value?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Expected Close Date</label>
                  <p>{opportunity.expected_close_date || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Opportunity Type</label>
                  <p>{opportunity.opportunity_type}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead Information */}
        {lead && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Lead Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">Primary Contact</label>
                  <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-400" />
                    <p>{lead.email}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    <p>{lead.phone || 'Not provided'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Lead Source</label>
                  <p>{lead.lead_source || 'Not specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderQuotationTab = () => {
    const { approved_quotation } = reviewData;
    
    if (!approved_quotation) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No approved quotation found for this opportunity</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Quotation Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Approved Quotation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Quotation Number</label>
                <p className="font-semibold">{approved_quotation.quotation_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge className="bg-green-100 text-green-800">
                  {approved_quotation.status}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Validity Date</label>
                <p>{approved_quotation.validity_date}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Grand Total</label>
                <p className="text-lg font-bold text-green-600">
                  ${approved_quotation.grand_total?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Pricing Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500">One-Time Payment</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${approved_quotation.total_otp?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Monthly Recurring</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${approved_quotation.total_year1?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-gray-500">per month</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-gray-500">Grand Total</p>
                <p className="text-2xl font-bold text-green-600">
                  ${approved_quotation.grand_total?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phases Breakdown */}
        {approved_quotation.phases && approved_quotation.phases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Project Phases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {approved_quotation.phases.map((phase, index) => (
                  <div key={phase.id || index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{phase.phase_name}</h4>
                      <Badge variant="outline">
                        ${phase.phase_grand_total?.toLocaleString() || '0'}
                      </Badge>
                    </div>
                    {phase.phase_description && (
                      <p className="text-sm text-gray-600 mb-2">{phase.phase_description}</p>
                    )}
                    {phase.groups && phase.groups.length > 0 && (
                      <div className="text-sm text-gray-500">
                        {phase.groups.length} group(s), {' '}
                        {phase.groups.reduce((total, group) => total + (group.items?.length || 0), 0)} item(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderSalesHistoryTab = () => {
    const { sales_history } = reviewData;
    
    if (!sales_history || sales_history.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">No sales history found</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Sales Process History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sales_history.map((entry, index) => (
              <div key={entry.id || index} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">
                <div className={`w-3 h-3 rounded-full mt-2 ${
                  entry.action_status === 'Success' ? 'bg-green-500' :
                  entry.action_status === 'Failed' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`}></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{entry.action_type}</h4>
                    <span className="text-sm text-gray-500">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{entry.action_description}</p>
                  {entry.user_name && (
                    <p className="text-xs text-gray-500 mt-1">by {entry.user_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const { sdr } = reviewData;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="outline"
            onClick={() => navigate('/service-delivery?tab=upcoming')}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Upcoming Projects
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Project Review</h1>
            <p className="text-gray-600">{sdr?.sd_request_id}</p>
          </div>
        </div>

        {/* Action Buttons */}
        {sdr?.approval_status === 'Pending' && (
          <div className="flex space-x-3">
            <Button
              onClick={handleConvertToProject}
              disabled={actionLoading.convert}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {actionLoading.convert ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Convert to Project
            </Button>
            
            <Button
              variant="outline"
              onClick={handleRejectOpportunity}
              disabled={actionLoading.reject}
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              {actionLoading.reject ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Reject Opportunity
            </Button>
          </div>
        )}
      </div>

      {/* Review Tabs */}
      <Tabs defaultValue="opportunity" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunity">Opportunity & Lead Data</TabsTrigger>
          <TabsTrigger value="quotation">Approved Quotation</TabsTrigger>
          <TabsTrigger value="history">Sales History</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="opportunity" className="space-y-4">
            {renderOpportunityTab()}
          </TabsContent>

          <TabsContent value="quotation" className="space-y-4">
            {renderQuotationTab()}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {renderSalesHistoryTab()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ServiceDeliveryDetails;