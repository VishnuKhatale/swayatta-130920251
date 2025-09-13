import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import {
  ArrowLeft,
  Building2,
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit3,
  Save,
  X,
  RefreshCw,
  Calendar,
  User,
  FileText,
  DollarSign
} from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

const ProjectProductManagement = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState({});
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productLogs, setProductLogs] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [updateLoading, setUpdateLoading] = useState({});

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

  // Load project details
  useEffect(() => {
    loadProjectDetails();
  }, [projectId]);

  const loadProjectDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/projects/${projectId}`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        const data = response.data.data;
        setProjectData(data);
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading project details:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Update product delivery status
  const updateProductStatus = async (productId, statusData) => {
    try {
      setUpdateLoading(prev => ({ ...prev, [productId]: true }));
      
      const response = await axios.put(
        `${API_BASE_URL}/api/service-delivery/projects/${projectId}/products/${productId}/status`,
        statusData,
        { headers: getAuthHeaders() }
      );
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Product delivery status updated successfully"
        });
        
        // Refresh project data
        await loadProjectDetails();
        setEditingProduct(null);
      }
    } catch (error) {
      console.error('Error updating product status:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to update product status';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setUpdateLoading(prev => ({ ...prev, [productId]: false }));
    }
  };

  // Load product activity logs
  const loadProductLogs = async (productId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/service-delivery/projects/${projectId}/products/${productId}/logs`,
        { headers: getAuthHeaders() }
      );
      
      if (response.data.success) {
        setProductLogs(prev => ({
          ...prev,
          [productId]: response.data.data
        }));
      }
    } catch (error) {
      console.error('Error loading product logs:', error);
      toast({
        title: "Error",
        description: "Failed to load product activity logs",
        variant: "destructive"
      });
    }
  };

  // Filter products based on status
  const getFilteredProducts = () => {
    if (statusFilter === 'all') return products;
    return products.filter(product => product.delivery_status === statusFilter);
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'Delivered':
        return 'bg-green-100 text-green-800';
      case 'In Transit':
        return 'bg-blue-100 text-blue-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'In Transit':
        return <Truck className="h-4 w-4" />;
      case 'Pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Render edit form
  const renderEditForm = (product) => {
    const [status, setStatus] = useState(product.delivery_status);
    const [notes, setNotes] = useState(product.delivery_notes || '');
    const [deliveredQty, setDeliveredQty] = useState(product.delivered_quantity || 0);

    const handleSubmit = (e) => {
      e.preventDefault();
      updateProductStatus(product.id, {
        delivery_status: status,
        delivery_notes: notes,
        delivered_quantity: parseInt(deliveredQty)
      });
    };

    return (
      <div className="border rounded-lg p-4 bg-gray-50">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Transit">In Transit</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivered Quantity
              </label>
              <Input
                type="number"
                min="0"
                max={product.quantity}
                value={deliveredQty}
                onChange={(e) => setDeliveredQty(e.target.value)}
                placeholder="Enter delivered quantity"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total: {product.quantity}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Notes
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add delivery notes..."
                rows={1}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingProduct(null)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateLoading[product.id]}
            >
              {updateLoading[product.id] ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Update Status
            </Button>
          </div>
        </form>
      </div>
    );
  };

  // Render product logs dialog
  const renderProductLogs = (product) => {
    const logs = productLogs[product.id] || [];
    
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadProductLogs(product.id)}
          >
            <FileText className="h-4 w-4 mr-1" />
            Activity Log
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Activity Log - {product.product_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No activity logs found</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={log.id || index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{log.activity_description}</h4>
                    <span className="text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Status: {log.previous_status} → {log.new_status}
                  </p>
                  {log.notes && (
                    <p className="text-sm text-gray-600 mt-1">
                      Notes: {log.notes}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    by {log.user_name}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
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

  const { project, opportunity, company, total_products, delivered_products, in_transit_products, pending_products } = projectData;
  const filteredProducts = getFilteredProducts();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="outline"
            onClick={() => navigate('/service-delivery?tab=projects')}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Delivery Management</h1>
            <p className="text-gray-600">{project?.sd_request_id}</p>
          </div>
        </div>
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">{opportunity?.opportunity_title}</div>
            <p className="text-sm text-gray-500">{company?.company_name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{total_products}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{delivered_products}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pending_products}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Product Deliveries</h2>
        <div className="flex items-center space-x-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Transit">In Transit</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={loadProjectDetails} 
            variant="outline" 
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-4">
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">
                {products.length === 0 ? 'No products found for this project' : 'No products match your filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                {editingProduct === product.id ? (
                  renderEditForm(product)
                ) : (
                  <div className="space-y-4">
                    {/* Product Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h3 className="font-semibold text-lg">{product.product_name}</h3>
                          <Badge className={getStatusBadgeVariant(product.delivery_status)}>
                            {getStatusIcon(product.delivery_status)}
                            <span className="ml-1">{product.delivery_status}</span>
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Phase:</span> {product.phase_name} | 
                          <span className="font-medium ml-2">Group:</span> {product.group_name}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {renderProductLogs(product)}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingProduct(product.id)}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Update Status
                        </Button>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-500">Total Quantity:</span>
                        <p className="font-semibold">{product.quantity}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Delivered:</span>
                        <p className="font-semibold text-green-600">{product.delivered_quantity || 0}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Unit Price:</span>
                        <p className="font-semibold">${product.unit_price?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Total Value:</span>
                        <p className="font-semibold">${product.total_price?.toLocaleString() || '0'}</p>
                      </div>
                    </div>

                    {/* Delivery Notes */}
                    {product.delivery_notes && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <span className="font-medium text-gray-500">Delivery Notes:</span>
                        <p className="text-sm mt-1">{product.delivery_notes}</p>
                      </div>
                    )}

                    {/* Last Updated */}
                    {product.last_updated && (
                      <div className="text-xs text-gray-500 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        Last updated: {new Date(product.last_updated).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ProjectProductManagement;