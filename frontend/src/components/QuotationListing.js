import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import {
  FileText,
  Eye,
  CheckCircle,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Download,
  Plus,
  Calendar,
  DollarSign,
  Building,
  User
} from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const QuotationListing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

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

  // Load data on component mount
  useEffect(() => {
    fetchQuotations();
    fetchCurrentUser();
  }, []);

  // Fetch current user information
  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setCurrentUser(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  // Fetch all quotations
  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/quotations`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setQuotations(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast({
        title: "Error",
        description: "Failed to load quotations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if current user can approve quotations
  const canApproveQuotations = () => {
    const userRole = currentUser?.role?.name || currentUser?.role;
    return ['Admin', 'Commercial Approver', 'Sales Manager'].includes(userRole);
  };

  // Approve quotation
  const approveQuotation = async (quotationId, event) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to approve this quotation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/quotations/${quotationId}/approve`, {}, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Quotation approved successfully"
        });
        fetchQuotations(); // Refresh quotations list
      }
    } catch (error) {
      console.error('Error approving quotation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to approve quotation';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Delete quotation
  const deleteQuotation = async (quotationId, event) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Quotation deleted successfully"
        });
        fetchQuotations(); // Refresh quotations list
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to delete quotation';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Filter and sort quotations
  const getFilteredQuotations = () => {
    let filtered = quotations;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(quotation => 
        quotation.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quotation.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quotation.opportunity_title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(quotation => {
        if (statusFilter === 'Draft') return quotation.status === 'Draft';
        if (statusFilter === 'Unapproved') return quotation.status === 'Unapproved';
        if (statusFilter === 'Approved') return quotation.status === 'Approved';
        return true;
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  };

  const filteredQuotations = getFilteredQuotations();

  // Get status badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      case 'Unapproved':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-gray-600 mt-1">Manage and review all quotations</p>
          </div>
          <Button 
            onClick={() => navigate('/quotation/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Quotation
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by quotation number, customer, or opportunity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Unapproved">Unapproved</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Created Date</SelectItem>
                <SelectItem value="updated_at">Updated Date</SelectItem>
                <SelectItem value="quotation_number">Quotation Number</SelectItem>
                <SelectItem value="grand_total">Amount</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>

            <Button 
              variant="outline" 
              onClick={fetchQuotations}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quotations List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredQuotations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quotations found</h3>
            <p className="text-gray-500 text-center mb-4">
              {quotations.length === 0 ? 'No quotations have been created yet' : 'No quotations match your current filters'}
            </p>
            <Button onClick={() => navigate('/quotation/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Quotation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredQuotations.map((quotation) => (
            <Card 
              key={quotation.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/quotation/${quotation.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {quotation.quotation_number || 'Draft Quotation'}
                      </h3>
                      <Badge className={getStatusBadge(quotation.status)}>
                        {quotation.status}
                      </Badge>
                      {quotation.validity_date && new Date(quotation.validity_date) < new Date() && (
                        <Badge className="bg-red-100 text-red-800">Expired</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-2 text-gray-400" />
                        <div>
                          <span className="font-medium">Customer:</span>
                          <p>{quotation.customer_name || 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <div>
                          <span className="font-medium">Created:</span>
                          <p>{new Date(quotation.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        <div>
                          <span className="font-medium">Amount:</span>
                          <p className="font-semibold text-gray-900">
                            ${quotation.grand_total?.toLocaleString() || '0.00'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <div>
                          <span className="font-medium">Valid Until:</span>
                          <p>{quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/quotation/${quotation.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    
                    {quotation.status === 'Unapproved' && canApproveQuotations() && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(event) => approveQuotation(quotation.id, event)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    
                    {['Draft', 'Unapproved'].includes(quotation.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => deleteQuotation(quotation.id, event)}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {filteredQuotations.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="font-semibold text-gray-900">{filteredQuotations.length}</div>
                <div className="text-gray-500">Total Quotations</div>
              </div>
              <div>
                <div className="font-semibold text-green-600">
                  {filteredQuotations.filter(q => q.status === 'Approved').length}
                </div>
                <div className="text-gray-500">Approved</div>
              </div>
              <div>
                <div className="font-semibold text-yellow-600">
                  {filteredQuotations.filter(q => q.status === 'Unapproved').length}
                </div>
                <div className="text-gray-500">Pending Approval</div>
              </div>
              <div>
                <div className="font-semibold text-gray-600">
                  ${filteredQuotations.reduce((sum, q) => sum + (q.grand_total || 0), 0).toLocaleString()}
                </div>
                <div className="text-gray-500">Total Value</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QuotationListing;