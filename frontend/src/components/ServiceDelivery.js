import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  MoreVertical,
  Package,
  PieChart,
  Plus,
  Search,
  Settings,
  Truck,
  Users,
  AlertTriangle,
  ArrowRight,
  Download,
  RefreshCw
} from 'lucide-react';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const ServiceDelivery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // State management
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Data states
  const [upcomingProjects, setUpcomingProjects] = useState([]);
  const [activeProjects, setActiveProjects] = useState([]);
  const [completedProjects, setCompletedProjects] = useState([]);
  const [deliveryLogs, setDeliveryLogs] = useState([]);
  const [analytics, setAnalytics] = useState({});

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

  // Initialize tab from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && ['upcoming', 'projects', 'completed', 'approvals', 'logs', 'reports'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Update URL when tab changes
  const changeTab = (tab) => {
    setActiveTab(tab);
    navigate(`/service-delivery?tab=${tab}`, { replace: true });
  };

  // Load data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case 'upcoming':
        loadUpcomingProjects();
        break;
      case 'projects':
        loadActiveProjects();
        break;
      case 'completed':
        loadCompletedProjects();
        break;
      case 'logs':
        loadDeliveryLogs();
        break;
      case 'reports':
        loadAnalytics();
        break;
      default:
        break;
    }
  }, [activeTab]);

  // API Functions
  const loadUpcomingProjects = async () => {
    try {
      setLoading(prev => ({ ...prev, upcoming: true }));
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/upcoming`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setUpcomingProjects(response.data.data);
      }
    } catch (error) {
      console.error('Error loading upcoming projects:', error);
      toast({
        title: "Error",
        description: "Failed to load upcoming projects",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, upcoming: false }));
    }
  };

  const loadActiveProjects = async () => {
    try {
      setLoading(prev => ({ ...prev, projects: true }));
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/projects`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setActiveProjects(response.data.data);
      }
    } catch (error) {
      console.error('Error loading active projects:', error);
      toast({
        title: "Error",
        description: "Failed to load active projects",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, projects: false }));
    }
  };

  const loadCompletedProjects = async () => {
    try {
      setLoading(prev => ({ ...prev, completed: true }));
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/completed`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setCompletedProjects(response.data.data);
      }
    } catch (error) {
      console.error('Error loading completed projects:', error);
      toast({
        title: "Error",
        description: "Failed to load completed projects",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, completed: false }));
    }
  };

  const loadDeliveryLogs = async () => {
    try {
      setLoading(prev => ({ ...prev, logs: true }));
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/logs?limit=50`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setDeliveryLogs(response.data.data);
      }
    } catch (error) {
      console.error('Error loading delivery logs:', error);
      toast({
        title: "Error",
        description: "Failed to load delivery logs",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(prev => ({ ...prev, analytics: true }));
      const response = await axios.get(`${API_BASE_URL}/api/service-delivery/analytics`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(prev => ({ ...prev, analytics: false }));
    }
  };

  // Action handlers
  const handleConvertToProject = async (sdrId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/service-delivery/upcoming/${sdrId}/convert`, {}, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Project converted successfully!"
        });
        loadUpcomingProjects(); // Refresh the list
      }
    } catch (error) {
      console.error('Error converting project:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to convert project';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleRejectOpportunity = async (sdrId, rejectionReason) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/service-delivery/upcoming/${sdrId}/reject`, {
        remarks: rejectionReason
      }, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Opportunity rejected successfully"
        });
        loadUpcomingProjects(); // Refresh the list
      }
    } catch (error) {
      console.error('Error rejecting opportunity:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to reject opportunity';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = async (sdrId) => {
    navigate(`/service-delivery/upcoming/${sdrId}/details`);
  };

  // Filter functions
  const getFilteredData = (data) => {
    let filtered = data;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.opportunity_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sd_request_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.approval_status === statusFilter);
    }
    
    return filtered;
  };

  // Render functions
  const renderUpcomingProjects = () => {
    const filteredProjects = getFilteredData(upcomingProjects);
    
    return (
      <div className="space-y-4">
        {/* Header and Filters */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Upcoming Projects</h2>
            <Badge variant="secondary">{filteredProjects.length} projects</Badge>
          </div>
          <Button 
            onClick={() => loadUpcomingProjects()} 
            variant="outline" 
            size="sm"
            disabled={loading.upcoming}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.upcoming ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex space-x-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by project name, client, or SDR ID..."
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
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        {loading.upcoming ? (
          <div className="flex justify-center items-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                {upcomingProjects.length === 0 ? 'No upcoming projects found' : 'No projects match your filters'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <h3 className="font-semibold text-lg">{project.opportunity_title || 'Untitled Project'}</h3>
                        <Badge 
                          className={
                            project.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                            project.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {project.approval_status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">SDR ID:</span>
                          <p>{project.sd_request_id}</p>
                        </div>
                        <div>
                          <span className="font-medium">Client:</span>
                          <p>{project.client_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Sales Owner:</span>
                          <p>{project.sales_owner_name || 'Unassigned'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Project Value:</span>
                          <p>${project.quotation_total?.toLocaleString() || '0'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(project.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      
                      {project.approval_status === 'Pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleConvertToProject(project.id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Convert to Project
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const reason = prompt('Please provide a reason for rejection:');
                              if (reason) {
                                handleRejectOpportunity(project.id, reason);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderActiveProjects = () => {
    const filteredProjects = getFilteredData(activeProjects);
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">Active Projects</h2>
            <Badge variant="secondary">{filteredProjects.length} projects</Badge>
          </div>
          <Button 
            onClick={() => loadActiveProjects()} 
            variant="outline" 
            size="sm"
            disabled={loading.projects}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.projects ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading.projects ? (
          <div className="flex justify-center items-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Truck className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No active projects found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-4">
                        <h3 className="font-semibold text-lg">{project.opportunity_title || 'Untitled Project'}</h3>
                        <Badge className="bg-blue-100 text-blue-800">
                          {project.delivery_status}
                        </Badge>
                        <Badge variant="outline">
                          {project.delivery_progress}% Complete
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
                        <div>
                          <span className="font-medium">Project ID:</span>
                          <p>{project.sd_request_id}</p>
                        </div>
                        <div>
                          <span className="font-medium">Client:</span>
                          <p>{project.client_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Delivery Owner:</span>
                          <p>{project.delivery_owner_name || 'Unassigned'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Expected Delivery:</span>
                          <p>{project.expected_delivery_date || 'TBD'}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.min(project.delivery_progress || 0, 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/service-delivery/projects/${project.id}`)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    const { status_distribution, delivery_distribution, metrics } = analytics;
    
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Service Delivery Analytics</h2>
          <Button 
            onClick={() => loadAnalytics()} 
            variant="outline" 
            size="sm"
            disabled={loading.analytics}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading.analytics ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading.analytics ? (
          <div className="flex justify-center items-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Status Distribution */}
            {status_distribution && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Upcoming Projects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{status_distribution.upcoming || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Active Projects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{status_distribution.projects || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Completed Projects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{status_distribution.completed || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Completion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{metrics?.completion_rate || 0}%</div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Service Delivery</h1>
        <p className="text-gray-600 mt-1">Manage project delivery from opportunities to completion</p>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={changeTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="upcoming" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Upcoming Projects</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center space-x-2">
            <Truck className="h-4 w-4" />
            <span>Projects</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4" />
            <span>Completed</span>
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Approvals</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Logs</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <PieChart className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Contents */}
        <div className="mt-6">
          <TabsContent value="upcoming" className="space-y-4">
            {renderUpcomingProjects()}
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            {renderActiveProjects()}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Completed Projects</h3>
              <p className="text-gray-500">View archived completed projects</p>
            </div>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Pending Approvals</h3>
              <p className="text-gray-500">Manage project approvals and reviews</p>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Delivery Logs</h3>
              <p className="text-gray-500">View audit trail and system logs</p>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            {renderAnalytics()}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ServiceDelivery;