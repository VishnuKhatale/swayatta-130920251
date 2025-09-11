import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Plus, Building, Users, TrendingUp, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import DataTable from './DataTable';
import ProtectedComponent from './ProtectedComponent';
import axios from 'axios';

const PartnersManagement = () => {
  const [partners, setPartners] = useState([]);
  const [masterData, setMasterData] = useState({
    jobFunctions: [],
    companyTypes: [],
    partnerTypes: [],
    headOfCompany: []
  });
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [viewingPartner, setViewingPartner] = useState(null);
  const [newPartner, setNewPartner] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_function_id: '',
    company_name: '',
    company_type_id: '',
    partner_type_id: '',
    head_of_company_id: '',
    gst_no: '',
    pan_no: ''
  });
  const { toast } = useToast();
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast({
          title: "Error",
          description: "Please login to access this page",
          variant: "destructive",
        });
        return;
      }

      const [
        partnersRes, 
        jobFunctionsRes, 
        companyTypesRes, 
        partnerTypesRes, 
        headOfCompanyRes
      ] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/partners`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/job-functions`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/company-types`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/partner-types`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/head-of-company`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (partnersRes.data.success) {
        setPartners(partnersRes.data.data);
      }
      
      setMasterData({
        jobFunctions: jobFunctionsRes.data.success ? jobFunctionsRes.data.data : [],
        companyTypes: companyTypesRes.data.success ? companyTypesRes.data.data : [],
        partnerTypes: partnerTypesRes.data.success ? partnerTypesRes.data.data : [],
        headOfCompany: headOfCompanyRes.data.success ? headOfCompanyRes.data.data : []
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validatePartnerForm = (partner, isEdit = false) => {
    // Required field validation
    const requiredFields = [
      { field: 'first_name', label: 'First Name' },
      { field: 'email', label: 'Email' },
      { field: 'job_function_id', label: 'Job Function' },
      { field: 'company_name', label: 'Company Name' },
      { field: 'company_type_id', label: 'Company Type' },
      { field: 'partner_type_id', label: 'Partner Type' },
      { field: 'head_of_company_id', label: 'Head of Company' }
    ];

    for (const { field, label } of requiredFields) {
      if (!partner[field]) {
        toast({
          title: "Validation Error",
          description: `${label} is required`,
          variant: "destructive",
        });
        return false;
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(partner.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    // Phone validation (numeric only if provided)
    if (partner.phone && !/^\d+$/.test(partner.phone)) {
      toast({
        title: "Validation Error",
        description: "Phone number must contain only digits",
        variant: "destructive",
      });
      return false;
    }

    // GST No validation (max 15 chars if provided)
    if (partner.gst_no && partner.gst_no.length > 15) {
      toast({
        title: "Validation Error",
        description: "GST Number cannot exceed 15 characters",
        variant: "destructive",
      });
      return false;
    }

    // PAN No validation (max 10 chars if provided)
    if (partner.pan_no && partner.pan_no.length > 10) {
      toast({
        title: "Validation Error",
        description: "PAN Number cannot exceed 10 characters",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const resetForm = () => {
    setNewPartner({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_function_id: '',
      company_name: '',
      company_type_id: '',
      partner_type_id: '',
      head_of_company_id: '',
      gst_no: '',
      pan_no: ''
    });
  };

  const handleCreatePartner = async () => {
    try {
      if (!validatePartnerForm(newPartner)) {
        return;
      }

      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${BACKEND_URL}/api/partners`, newPartner, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Partner created successfully",
        });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create partner",
        variant: "destructive",
      });
    }
  };

  const handleEditPartner = (partner) => {
    setEditingPartner({ ...partner });
    setIsEditDialogOpen(true);
  };

  const handleViewPartner = (partner) => {
    setViewingPartner(partner);
    setIsViewDialogOpen(true);
  };

  const handleUpdatePartner = async () => {
    try {
      if (!validatePartnerForm(editingPartner, true)) {
        return;
      }

      const token = localStorage.getItem('access_token');
      const response = await axios.put(`${BACKEND_URL}/api/partners/${editingPartner.partner_id}`, editingPartner, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Partner updated successfully",
        });
        setIsEditDialogOpen(false);
        setEditingPartner(null);
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update partner",
        variant: "destructive",
      });
    }
  };

  const handleDeletePartner = async (partnerId) => {
    if (!window.confirm('Are you sure you want to delete this partner?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.delete(`${BACKEND_URL}/api/partners/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Partner deleted successfully",
        });
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete partner",
        variant: "destructive",
      });
    }
  };

  const handleExportPartners = (data) => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Job Function', 'Company Name', 'Company Type', 'Partner Type', 'Head of Company', 'GST No', 'PAN No', 'Status', 'Created At'];
    const rows = data.map(partner => [
      partner.first_name,
      partner.last_name,
      partner.email,
      partner.phone || '',
      partner.job_function_name,
      partner.company_name || '',
      partner.company_type_name || '',
      partner.partner_type_name || '',
      partner.head_of_company_name || '',
      partner.gst_no || '',
      partner.pan_no || '',
      partner.is_active ? 'Active' : 'Inactive',
      new Date(partner.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'partners_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const partnerColumns = [
    {
      key: 'first_name',
      header: 'First Name',
      sortable: true
    },
    {
      key: 'last_name',
      header: 'Last Name',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (value) => value || '-'
    },
    {
      key: 'job_function_name',
      header: 'Job Function',
      render: (value) => (
        <Badge variant="secondary">{value}</Badge>
      )
    },
    {
      key: 'company_name',
      header: 'Company',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'company_type_name',
      header: 'Company Type',
      render: (value) => value ? (
        <Badge variant="outline">{value}</Badge>
      ) : '-'
    },
    {
      key: 'partner_type_name',
      header: 'Partner Type',
      render: (value) => value ? (
        <Badge className="bg-blue-100 text-blue-800">{value}</Badge>
      ) : '-'
    },
    {
      key: 'gst_no',
      header: 'GST No',
      render: (value) => value || '-'
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => (
        <Badge className={value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'created_at',
      header: 'Created At',
      type: 'date',
      sortable: true
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (_, partner) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => handleViewPartner(partner)}>
            <Eye className="h-4 w-4" />
          </Button>
          <ProtectedComponent menuPath="/partners" permission="edit">
            <Button variant="ghost" size="sm" onClick={() => handleEditPartner(partner)}>
              <Edit className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
          <ProtectedComponent menuPath="/partners" permission="delete">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-600 hover:text-red-800"
              onClick={() => handleDeletePartner(partner.partner_id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
        </div>
      )
    }
  ];

  const createPartnerAction = (
    <ProtectedComponent menuPath="/partners" permission="create">
      <Button 
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => setIsCreateDialogOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Partner
      </Button>
    </ProtectedComponent>
  );

  // Calculate stats
  const totalPartners = partners.length;
  const activePartners = partners.filter(p => p.is_active).length;
  const thisMonthPartners = partners.filter(p => {
    const created = new Date(p.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Partners Management</h2>
          <p className="text-slate-600">Manage business partners and strategic alliances</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
            <Building className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalPartners}</div>
            <p className="text-xs text-slate-600 mt-1">All partners</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activePartners}</div>
            <p className="text-xs text-slate-600 mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Job Functions</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{masterData.jobFunctions.length}</div>
            <p className="text-xs text-slate-600 mt-1">Available roles</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Plus className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{thisMonthPartners}</div>
            <p className="text-xs text-slate-600 mt-1">New partners</p>
          </CardContent>
        </Card>
      </div>

      {/* Partners Table */}
      <DataTable
        data={partners}
        columns={partnerColumns}
        title="Partners"
        searchable={true}
        exportable={true}
        onExport={handleExportPartners}
        onRefresh={fetchData}
        loading={loading}
        actions={createPartnerAction}
        pageSize={10}
      />

      {/* Create Partner Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Partner</DialogTitle>
            <DialogDescription>Add a new business partner to the system</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Partner Information Section */}
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-lg font-medium text-slate-900">Partner Information</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-first-name">First Name *</Label>
                  <Input
                    id="create-first-name"
                    value={newPartner.first_name}
                    onChange={(e) => setNewPartner({ ...newPartner, first_name: e.target.value })}
                    placeholder="Enter first name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-last-name">Last Name</Label>
                  <Input
                    id="create-last-name"
                    value={newPartner.last_name}
                    onChange={(e) => setNewPartner({ ...newPartner, last_name: e.target.value })}
                    placeholder="Enter last name"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="create-email">Email *</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={newPartner.email}
                  onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                  placeholder="Enter email address"
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-phone">Phone</Label>
                  <Input
                    id="create-phone"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="Enter phone number"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="create-job-function">Job Function *</Label>
                  <Select value={newPartner.job_function_id} onValueChange={(value) => setNewPartner({ ...newPartner, job_function_id: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select job function" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterData.jobFunctions.map((jobFunc) => (
                        <SelectItem key={jobFunc.job_function_id} value={jobFunc.job_function_id}>
                          {jobFunc.job_function_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Company Information Section */}
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-lg font-medium text-slate-900">Company Information</h3>
              </div>
              
              <div>
                <Label htmlFor="create-company-name">Company Name *</Label>
                <Input
                  id="create-company-name"
                  value={newPartner.company_name}
                  onChange={(e) => setNewPartner({ ...newPartner, company_name: e.target.value })}
                  placeholder="Enter company name"
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-company-type">Company Type *</Label>
                  <Select value={newPartner.company_type_id} onValueChange={(value) => setNewPartner({ ...newPartner, company_type_id: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select company type" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterData.companyTypes.map((type) => (
                        <SelectItem key={type.company_type_id} value={type.company_type_id}>
                          {type.company_type_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-partner-type">Partner Type *</Label>
                  <Select value={newPartner.partner_type_id} onValueChange={(value) => setNewPartner({ ...newPartner, partner_type_id: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select partner type" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterData.partnerTypes.map((type) => (
                        <SelectItem key={type.partner_type_id} value={type.partner_type_id}>
                          {type.partner_type_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="create-head-of-company">Head of Company *</Label>
                <Select value={newPartner.head_of_company_id} onValueChange={(value) => setNewPartner({ ...newPartner, head_of_company_id: value })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select head of company" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterData.headOfCompany.map((head) => (
                      <SelectItem key={head.head_of_company_id} value={head.head_of_company_id}>
                        {head.head_role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-gst-no">GST No</Label>
                  <Input
                    id="create-gst-no"
                    value={newPartner.gst_no}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length <= 15) {
                        setNewPartner({ ...newPartner, gst_no: value });
                      }
                    }}
                    placeholder="Enter GST number (max 15 chars)"
                    className="mt-1"
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label htmlFor="create-pan-no">PAN No</Label>
                  <Input
                    id="create-pan-no"
                    value={newPartner.pan_no}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      if (value.length <= 10) {
                        setNewPartner({ ...newPartner, pan_no: value });
                      }
                    }}
                    placeholder="Enter PAN number (max 10 chars)"
                    className="mt-1"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreatePartner} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
            <DialogDescription>Update partner information</DialogDescription>
          </DialogHeader>
          
          {editingPartner && (
            <div className="space-y-6">
              {/* Partner Information Section */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-medium text-slate-900">Partner Information</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-first-name">First Name *</Label>
                    <Input
                      id="edit-first-name"
                      value={editingPartner.first_name}
                      onChange={(e) => setEditingPartner({ ...editingPartner, first_name: e.target.value })}
                      placeholder="Enter first name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-last-name">Last Name</Label>
                    <Input
                      id="edit-last-name"
                      value={editingPartner.last_name || ''}
                      onChange={(e) => setEditingPartner({ ...editingPartner, last_name: e.target.value })}
                      placeholder="Enter last name"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingPartner.email}
                    onChange={(e) => setEditingPartner({ ...editingPartner, email: e.target.value })}
                    placeholder="Enter email address"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editingPartner.phone || ''}
                      onChange={(e) => setEditingPartner({ ...editingPartner, phone: e.target.value.replace(/\D/g, '') })}
                      placeholder="Enter phone number"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-job-function">Job Function *</Label>
                    <Select value={editingPartner.job_function_id} onValueChange={(value) => setEditingPartner({ ...editingPartner, job_function_id: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select job function" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.jobFunctions.map((jobFunc) => (
                          <SelectItem key={jobFunc.job_function_id} value={jobFunc.job_function_id}>
                            {jobFunc.job_function_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Company Information Section */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-medium text-slate-900">Company Information</h3>
                </div>
                
                <div>
                  <Label htmlFor="edit-company-name">Company Name *</Label>
                  <Input
                    id="edit-company-name"
                    value={editingPartner.company_name || ''}
                    onChange={(e) => setEditingPartner({ ...editingPartner, company_name: e.target.value })}
                    placeholder="Enter company name"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-company-type">Company Type *</Label>
                    <Select value={editingPartner.company_type_id || ''} onValueChange={(value) => setEditingPartner({ ...editingPartner, company_type_id: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select company type" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.companyTypes.map((type) => (
                          <SelectItem key={type.company_type_id} value={type.company_type_id}>
                            {type.company_type_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-partner-type">Partner Type *</Label>
                    <Select value={editingPartner.partner_type_id || ''} onValueChange={(value) => setEditingPartner({ ...editingPartner, partner_type_id: value })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select partner type" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.partnerTypes.map((type) => (
                          <SelectItem key={type.partner_type_id} value={type.partner_type_id}>
                            {type.partner_type_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="edit-head-of-company">Head of Company *</Label>
                  <Select value={editingPartner.head_of_company_id || ''} onValueChange={(value) => setEditingPartner({ ...editingPartner, head_of_company_id: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select head of company" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterData.headOfCompany.map((head) => (
                        <SelectItem key={head.head_of_company_id} value={head.head_of_company_id}>
                          {head.head_role_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-gst-no">GST No</Label>
                    <Input
                      id="edit-gst-no"
                      value={editingPartner.gst_no || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.length <= 15) {
                          setEditingPartner({ ...editingPartner, gst_no: value });
                        }
                      }}
                      placeholder="Enter GST number (max 15 chars)"
                      className="mt-1"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-pan-no">PAN No</Label>
                    <Input
                      id="edit-pan-no"
                      value={editingPartner.pan_no || ''}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        if (value.length <= 10) {
                          setEditingPartner({ ...editingPartner, pan_no: value });
                        }
                      }}
                      placeholder="Enter PAN number (max 10 chars)"
                      className="mt-1"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingPartner(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePartner} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Partner Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Partner</DialogTitle>
            <DialogDescription>Partner information (read-only)</DialogDescription>
          </DialogHeader>
          
          {viewingPartner && (
            <div className="space-y-6">
              {/* Partner Information Section */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-medium text-slate-900">Partner Information</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name *</Label>
                    <Input
                      value={viewingPartner.first_name}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={viewingPartner.last_name || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Email *</Label>
                  <Input
                    value={viewingPartner.email}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={viewingPartner.phone || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>Job Function *</Label>
                    <Input
                      value={viewingPartner.job_function_name || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              {/* Company Information Section */}
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-medium text-slate-900">Company Information</h3>
                </div>
                
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={viewingPartner.company_name || ''}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Company Type *</Label>
                    <Input
                      value={viewingPartner.company_type_name || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>Partner Type *</Label>
                    <Input
                      value={viewingPartner.partner_type_name || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Head of Company *</Label>
                  <Input
                    value={viewingPartner.head_of_company_name || ''}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>GST No</Label>
                    <Input
                      value={viewingPartner.gst_no || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>PAN No</Label>
                    <Input
                      value={viewingPartner.pan_no || ''}
                      disabled
                      className="mt-1 bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setIsViewDialogOpen(false); setViewingPartner(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnersManagement;