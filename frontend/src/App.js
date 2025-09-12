import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Import components
import DepartmentsManagement from './components/DepartmentsManagement';
import PermissionsManagement from './components/PermissionsManagement';
import RolePermissionsManagement from './components/RolePermissionsManagement';
import MenuManagement from './components/MenuManagement';
import UserManagementComplete from './components/UserManagementComplete';
import ActivityLogsReporting from './components/ActivityLogsReporting';
import PartnersManagement from './components/PartnersManagement';
import CompaniesManagement from './components/CompaniesManagement';
import LeadManagement from './components/LeadManagement';
import OpportunityManagement from './components/OpportunityManagement';
import EnhancedOpportunityManagement from './components/EnhancedOpportunityManagement';
import QuotationManagement from './components/QuotationManagement';
import ServiceDelivery from './components/ServiceDelivery';
import ServiceDeliveryDetails from './components/ServiceDeliveryDetails';

import MasterDataManagement from './components/MasterDataManagement';
import ProtectedComponent from './components/ProtectedComponent';
import DataTable from './components/DataTable';
import { PermissionProvider, usePermissions } from './contexts/PermissionContext';

// Import shadcn components
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Separator } from './components/ui/separator';
import { Alert, AlertDescription } from './components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { useToast } from './hooks/use-toast';
import { Toaster } from './components/ui/toaster';

// Icons
import { Menu, Users, UserPlus, Settings, LogOut, Shield, Building, Activity, Eye, Edit, Trash2, Plus, Key, Settings2, FolderTree, BarChart3, ChevronDown, ChevronRight, ShoppingCart, Handshake, Building2, Target, TrendingUp, Truck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      if (response.data.success) {
        setUser(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      if (response.data.success) {
        const { access_token, user: userData } = response.data.data;
        localStorage.setItem('access_token', access_token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        setUser(userData);
        return { success: true };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API}/auth/register`, userData);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Registration failed' 
      };
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(email, password);
    if (result.success) {
      toast({
        title: "Login Successful",
        description: "Welcome to the ERP System",
      });
      // Force navigation to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } else {
      toast({
        title: "Login Failed",
        description: result.message,
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-slate-900">ERP System</CardTitle>
          <CardDescription className="text-slate-600">Enter your credentials to access the system</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-300 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-300 focus:border-blue-500"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

// Dashboard Layout Component
const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const { canView } = usePermissions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    'User Management': true, // Default expanded
    'Sales': false
  });

  const menuSections = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: Activity,
      type: 'single'
    },
    {
      name: 'User Management',
      icon: Users,
      type: 'group',
      items: [
        { name: 'Users', path: '/users', icon: Users },
        { name: 'Roles', path: '/roles', icon: Shield },
        { name: 'Departments', path: '/departments', icon: Building },
        { name: 'Permissions', path: '/permissions', icon: Key },
        { name: 'Role Permissions', path: '/role-permissions', icon: Settings2 },
        { name: 'Menus', path: '/menus', icon: FolderTree }
      ]
    },
    {
      name: 'Sales',
      icon: ShoppingCart,
      type: 'group',
      items: [
        { name: 'Partners', path: '/partners', icon: Handshake },
        { name: 'Companies', path: '/companies', icon: Building2 },
        { name: 'Leads', path: '/leads', icon: Target },
        { name: 'Opportunities', path: '/opportunities', icon: TrendingUp },
        { name: 'Enhanced Opportunities', path: '/enhanced-opportunities', icon: TrendingUp },
        { name: 'Service Delivery', path: '/service-delivery', icon: Truck },
        { name: 'Master Data', path: '/master-data', icon: Settings2 }
      ]
    },
    {
      name: 'Activity Logs',
      path: '/activity-logs',
      icon: BarChart3,
      type: 'single'
    }
  ];

  // Filter menu sections and items based on permissions
  const getFilteredMenuSections = () => {
    return menuSections.map(section => {
      if (section.type === 'single') {
        // Check if user has view permission for single items
        if (!canView(section.path)) {
          return null;
        }
        return section;
      } else {
        // For groups, filter the sub-items based on permissions
        const filteredItems = section.items.filter(item => canView(item.path));
        
        // Only show the group if it has at least one visible item
        if (filteredItems.length === 0) {
          return null;
        }
        
        return {
          ...section,
          items: filteredItems
        };
      }
    }).filter(Boolean); // Remove null items
  };

  const handleNavigation = (path) => {
    window.location.href = path;
  };

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const filteredMenuSections = getFilteredMenuSections();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile menu */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="p-6">
            <h2 className="text-xl font-bold text-slate-900">ERP System</h2>
          </div>
          <nav className="space-y-1 px-3">
            {filteredMenuSections.map((section) => (
              <div key={section.name}>
                {section.type === 'single' ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => handleNavigation(section.path)}
                  >
                    <section.icon className="mr-3 h-5 w-5" />
                    {section.name}
                  </Button>
                ) : (
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-medium"
                      onClick={() => toggleSection(section.name)}
                    >
                      <section.icon className="mr-3 h-5 w-5" />
                      <span className="flex-1 text-left">{section.name}</span>
                      {expandedSections[section.name] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {expandedSections[section.name] && (
                      <div className="ml-6 space-y-1">
                        {section.items.map((item) => (
                          <Button
                            key={item.name}
                            variant="ghost"
                            className="w-full justify-start text-slate-600 hover:bg-blue-50 hover:text-blue-700 pl-6"
                            onClick={() => handleNavigation(item.path)}
                          >
                            <item.icon className="mr-3 h-4 w-4" />
                            {item.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-slate-200 shadow-sm">
          <div className="flex-1">
            <div className="px-6 py-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">ERP System</h2>
            </div>
            <nav className="mt-6 space-y-1 px-3">
              {filteredMenuSections.map((section) => (
                <div key={section.name}>
                  {section.type === 'single' ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                      onClick={() => handleNavigation(section.path)}
                    >
                      <section.icon className="mr-3 h-5 w-5" />
                      {section.name}
                    </Button>
                  ) : (
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
                        onClick={() => toggleSection(section.name)}
                      >
                        <section.icon className="mr-3 h-5 w-5" />
                        <span className="flex-1 text-left">{section.name}</span>
                        {expandedSections[section.name] ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      {expandedSections[section.name] && (
                        <div className="ml-6 space-y-1">
                          {section.items.map((item) => (
                            <Button
                              key={item.name}
                              variant="ghost"
                              className="w-full justify-start text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors pl-6"
                              onClick={() => handleNavigation(item.path)}
                            >
                              <item.icon className="mr-3 h-4 w-4" />
                              {item.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="lg:hidden mr-2"
                  onClick={() => setIsMobileMenuOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="text-slate-600 hover:text-red-600">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRoles: 0,
    totalDepartments: 0,
    activeUsers: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch basic stats
      const [usersRes, rolesRes, deptsRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/roles`),
        axios.get(`${API}/departments`)
      ]);

      setStats({
        totalUsers: usersRes.data.data?.length || 0,
        totalRoles: rolesRes.data.data?.length || 0,
        totalDepartments: deptsRes.data.data?.length || 0,
        activeUsers: usersRes.data.data?.filter(u => u.is_active)?.length || 0
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
    { title: 'Active Users', value: stats.activeUsers, icon: Activity, color: 'green' },
    { title: 'Roles', value: stats.totalRoles, icon: Shield, color: 'purple' },
    { title: 'Departments', value: stats.totalDepartments, icon: Building, color: 'orange' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Overview</h2>
        <p className="text-slate-600">Welcome to your ERP management system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full bg-${stat.color}-100`}>
                  <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Frequently used actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white">
              <UserPlus className="mr-2 h-4 w-4" />
              Add New User
            </Button>
            <Button variant="outline" className="w-full justify-start border-slate-300 hover:bg-slate-50">
              <Shield className="mr-2 h-4 w-4" />
              Manage Roles
            </Button>
            <Button variant="outline" className="w-full justify-start border-slate-300 hover:bg-slate-50">
              <Building className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">System Status</span>
              <Badge className="bg-green-100 text-green-800">Online</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Database</span>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Last Backup</span>
              <span className="text-sm text-slate-900">2 hours ago</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Roles Management Component
const RolesManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await axios.get(`${API}/roles`);
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(`${API}/roles`, formData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Role created successfully",
        });
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '' });
        fetchRoles();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create role",
        variant: "destructive",
      });
    }
  };

  const handleEditRole = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.put(`${API}/roles/${selectedRole.id}`, formData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Role updated successfully",
        });
        setIsEditDialogOpen(false);
        setSelectedRole(null);
        setFormData({ name: '', description: '' });
        fetchRoles();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRole = async () => {
    try {
      const response = await axios.delete(`${API}/roles/${selectedRole.id}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Role deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        setSelectedRole(null);
        fetchRoles();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete role",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || ''
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (role) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Roles Management</h2>
          <p className="text-slate-600">Manage system roles and their descriptions</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description || 'No description'}</TableCell>
                  <TableCell>
                    <Badge className={role.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {role.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(role.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => window.location.href = '/role-permissions'}
                        title="Manage Permissions"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-800"
                        onClick={() => openDeleteDialog(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Add a new role to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Role Name *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter role name"
              />
            </div>
            <div>
              <Label htmlFor="create-description">Description</Label>
              <Input
                id="create-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter role description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Role Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter role name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter role description (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRole} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteRole} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
// Initialize Database Component
const InitializeDB = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  const initializeDatabase = async () => {
    try {
      const response = await axios.post(`${API}/init-db`);
      if (response.data.success) {
        setIsInitialized(true);
        toast({
          title: "Success",
          description: "Database initialized successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to initialize database",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Initialize Database</CardTitle>
          <CardDescription>Set up default data and business verticals</CardDescription>
        </CardHeader>
        <CardContent>
          {!isInitialized ? (
            <Button onClick={initializeDatabase} className="w-full">
              Initialize Database
            </Button>
          ) : (
            <div className="text-center">
              <div className="text-green-600 mb-2">✓ Database initialized successfully!</div>
              <Button onClick={() => window.location.reload()} className="w-full">
                Continue to Application
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <DashboardLayout>{children}</DashboardLayout>;
};

// Main App Component
function App() {
  return (
    <div className="App">
      <PermissionProvider>
        <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/init" element={<InitializeDB />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute>
                <UserManagementComplete />
              </ProtectedRoute>
            } />
            <Route path="/roles" element={
              <ProtectedRoute>
                <RolesManagement />
              </ProtectedRoute>
            } />
            <Route path="/role-permissions" element={
              <ProtectedRoute>
                <RolePermissionsManagement />
              </ProtectedRoute>
            } />
            <Route path="/departments" element={
              <ProtectedRoute>
                <DepartmentsManagement />
              </ProtectedRoute>
            } />
            <Route path="/permissions" element={
              <ProtectedRoute>
                <PermissionsManagement />
              </ProtectedRoute>
            } />
            <Route path="/menus" element={
              <ProtectedRoute>
                <MenuManagement />
              </ProtectedRoute>
            } />
            <Route path="/activity-logs" element={
              <ProtectedRoute>
                <ActivityLogsReporting />
              </ProtectedRoute>
            } />
            <Route path="/partners" element={
              <ProtectedRoute>
                <PartnersManagement />
              </ProtectedRoute>
            } />
            <Route path="/companies" element={
              <ProtectedRoute>
                <CompaniesManagement />
              </ProtectedRoute>
            } />
            <Route path="/leads" element={
              <ProtectedRoute>
                <LeadManagement />
              </ProtectedRoute>
            } />
            <Route path="/opportunities" element={
              <ProtectedRoute>
                <OpportunityManagement />
              </ProtectedRoute>
            } />
            <Route path="/enhanced-opportunities" element={
              <ProtectedRoute>
                <EnhancedOpportunityManagement />
              </ProtectedRoute>
            } />
            {/* Unified Opportunity Management Routes */}
            <Route path="/opportunities/new" element={
              <ProtectedRoute>
                <OpportunityManagement />
              </ProtectedRoute>
            } />
            <Route path="/opportunities/:opportunityId" element={
              <ProtectedRoute>
                <OpportunityManagement />
              </ProtectedRoute>
            } />
            <Route path="/opportunities/:opportunityId/edit" element={
              <ProtectedRoute>
                <OpportunityManagement />
              </ProtectedRoute>
            } />
            <Route path="/quotation/new" element={
              <ProtectedRoute>
                <QuotationManagement />
              </ProtectedRoute>
            } />
            <Route path="/quotation/:quotationId" element={
              <ProtectedRoute>
                <QuotationManagement />
              </ProtectedRoute>
            } />
            <Route path="/master-data" element={
              <ProtectedRoute>
                <MasterDataManagement />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </PermissionProvider>
    </div>
  );
}

export default App;