import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Settings2, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import DataTable from './DataTable';
import ProtectedComponent from './ProtectedComponent';
import axios from 'axios';

const MasterDataManagement = () => {
  const [masterData, setMasterData] = useState({});
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTable, setActiveTable] = useState('job-functions');
  const [editingRecord, setEditingRecord] = useState(null);
  const [newRecord, setNewRecord] = useState({});
  const { toast } = useToast();
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  // Master table configurations - Enhanced with all required masters
  const masterTables = [
    {
      key: 'departments',
      name: 'Departments',
      endpoint: 'departments',
      fields: [
        { key: 'name', label: 'Department Name', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'text', required: false }
      ],
      primaryKey: 'id'
    },
    {
      key: 'business-verticals',
      name: 'Business Verticals',
      endpoint: 'business-verticals',
      fields: [
        { key: 'name', label: 'Business Vertical Name', type: 'text', required: true }
      ],
      primaryKey: 'id'
    },
    {
      key: 'roles',
      name: 'Roles',
      endpoint: 'roles',
      fields: [
        { key: 'name', label: 'Role Name', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'text', required: false }
      ],
      primaryKey: 'id'
    },
    {
      key: 'permissions',
      name: 'Permissions',
      endpoint: 'permissions',
      fields: [
        { key: 'name', label: 'Permission Name', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'text', required: false }
      ],
      primaryKey: 'id'
    },
    {
      key: 'job-functions',
      name: 'Job Functions',
      endpoint: 'master/job-functions',
      fields: [
        { key: 'job_function_name', label: 'Job Function Name', type: 'text', required: true }
      ],
      primaryKey: 'job_function_id'
    },
    {
      key: 'partner-types',
      name: 'Partner Types',
      endpoint: 'master/partner-types',
      fields: [
        { key: 'partner_type_name', label: 'Partner Type Name', type: 'text', required: true }
      ],
      primaryKey: 'partner_type_id'
    },
    {
      key: 'company-types',
      name: 'Company Types',
      endpoint: 'master/company-types',
      fields: [
        { key: 'company_type_name', label: 'Company Type Name', type: 'text', required: true }
      ],
      primaryKey: 'company_type_id'
    },
    {
      key: 'head-of-company',
      name: 'Head of Company',
      endpoint: 'master/head-of-company',
      fields: [
        { key: 'head_role_name', label: 'Head Role Name', type: 'text', required: true }
      ],
      primaryKey: 'head_of_company_id'
    },
    {
      key: 'countries',
      name: 'Countries',
      endpoint: 'master/countries',
      fields: [
        { key: 'country_name', label: 'Country Name', type: 'text', required: true },
        { key: 'country_code', label: 'Country Code', type: 'text', required: true }
      ],
      primaryKey: 'country_id'
    },
    {
      key: 'states',
      name: 'States',
      endpoint: 'master/states',
      fields: [
        { key: 'state_name', label: 'State Name', type: 'text', required: true },
        { key: 'country_id', label: 'Country', type: 'select', required: true, options: 'countries' }
      ],
      primaryKey: 'state_id'
    },
    {
      key: 'cities',
      name: 'Cities',
      endpoint: 'master/cities',
      fields: [
        { key: 'city_name', label: 'City Name', type: 'text', required: true },
        { key: 'state_id', label: 'State', type: 'select', required: true, options: 'states' }
      ],
      primaryKey: 'city_id'
    },
    {
      key: 'document-types',
      name: 'Document Types',
      endpoint: 'master/document-types',
      fields: [
        { key: 'document_type_name', label: 'Document Type Name', type: 'text', required: true }
      ],
      primaryKey: 'document_type_id'
    },
    {
      key: 'currencies',
      name: 'Currencies',
      endpoint: 'master/currencies',
      fields: [
        { key: 'currency_code', label: 'Currency Code', type: 'text', required: true },
        { key: 'currency_name', label: 'Currency Name', type: 'text', required: true },
        { key: 'symbol', label: 'Symbol', type: 'text', required: true }
      ],
      primaryKey: 'currency_id'
    },
    {
      key: 'products',
      name: 'Product Catalog',
      endpoint: 'products/catalog',
      fields: [
        { key: 'core_product_name', label: 'Product Name', type: 'text', required: true },
        { key: 'skucode', label: 'SKU Code', type: 'text', required: true },
        { key: 'primary_category', label: 'Primary Category', type: 'text', required: true },
        { key: 'secondary_category', label: 'Secondary Category', type: 'text', required: false },
        { key: 'tertiary_category', label: 'Tertiary Category', type: 'text', required: false },
        { key: 'fourth_category', label: 'Fourth Category', type: 'text', required: false },
        { key: 'fifth_category', label: 'Fifth Category', type: 'text', required: false },
        { key: 'product_description', label: 'Description', type: 'textarea', required: false },
        { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', required: true },
        { key: 'is_active', label: 'Status', type: 'select', required: true, options: [
          { value: true, label: 'Active' },
          { value: false, label: 'Inactive' }
        ]}
      ],
      primaryKey: 'id'
    },
    {
      key: 'pricing-lists',
      name: 'Pricing Lists',
      endpoint: 'pricing-lists',
      fields: [
        { key: 'name', label: 'Pricing List Name', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'textarea', required: false },
        { key: 'effective_date', label: 'Effective Date', type: 'date', required: true },
        { key: 'expiry_date', label: 'Expiry Date', type: 'date', required: false },
        { key: 'markup_percentage', label: 'Markup %', type: 'number', required: false },
        { key: 'is_default', label: 'Is Default', type: 'select', required: true, options: [
          { value: true, label: 'Yes' },
          { value: false, label: 'No' }
        ]},
        { key: 'is_active', label: 'Status', type: 'select', required: true, options: [
          { value: true, label: 'Active' },
          { value: false, label: 'Inactive' }
        ]}
      ],
      primaryKey: 'id'
    },
    {
      key: 'pricing-models',
      name: 'Product Pricing',
      endpoint: 'pricing-models',
      fields: [
        { key: 'core_product_id', label: 'Product', type: 'select', required: true, options: 'products' },
        { key: 'pricing_list_id', label: 'Rate Card', type: 'select', required: true, options: 'pricing-lists' },
        { key: 'pricing_model_name', label: 'Pricing Model Name', type: 'text', required: true },
        { key: 'selling_price', label: 'One-Time Price (Y1)', type: 'number', required: true },
        { key: 'selling_price_y2', label: 'OTP Y2', type: 'number', required: false },
        { key: 'selling_price_y3', label: 'OTP Y3', type: 'number', required: false },
        { key: 'recurring_selling_price', label: 'Recurring Price (Monthly)', type: 'number', required: true },
        { key: 'currency_id', label: 'Currency', type: 'select', required: true, options: 'currencies' },
        { key: 'is_active', label: 'Status', type: 'select', required: true, options: [
          { value: true, label: 'Active' },
          { value: false, label: 'Inactive' }
        ]}
      ],
      primaryKey: 'id'
    }
  ];

  useEffect(() => {
    fetchAllMasterData();
  }, []);

  const fetchAllMasterData = async () => {
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

      const promises = masterTables.map(table => 
        axios.get(`${BACKEND_URL}/api/${table.endpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(error => ({ data: { success: false, error: error.message } }))
      );

      const responses = await Promise.all(promises);
      
      const newMasterData = {};
      masterTables.forEach((table, index) => {
        const response = responses[index];
        if (response.data && response.data.success) {
          newMasterData[table.key] = response.data.data;
        } else {
          newMasterData[table.key] = [];
        }
      });

      setMasterData(newMasterData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch master data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableKey) => {
    try {
      const token = localStorage.getItem('access_token');
      const table = masterTables.find(t => t.key === tableKey);
      if (!table) return;
      
      const response = await axios.get(`${BACKEND_URL}/api/${table.endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.success) {
        setMasterData(prev => ({
          ...prev,
          [tableKey]: response.data.data
        }));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to fetch ${tableKey} data`,
        variant: "destructive",
      });
    }
  };

  const handleCreateRecord = async () => {
    try {
      const table = masterTables.find(t => t.key === activeTable);
      
      // Validate required fields
      for (const field of table.fields) {
        if (field.required && !newRecord[field.key]) {
          toast({
            title: "Validation Error",
            description: `${field.label} is required`,
            variant: "destructive",
          });
          return;
        }
      }

      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${BACKEND_URL}/api/master/${activeTable}`, newRecord, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: `${table.name} created successfully`,
        });
        setIsCreateDialogOpen(false);
        setNewRecord({});
        fetchTableData(activeTable);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || `Failed to create ${activeTable}`,
        variant: "destructive",
      });
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecord({ ...record });
    setIsEditDialogOpen(true);
  };

  const handleUpdateRecord = async () => {
    try {
      const table = masterTables.find(t => t.key === activeTable);
      const recordId = editingRecord[table.primaryKey];

      const token = localStorage.getItem('access_token');
      const response = await axios.put(`${BACKEND_URL}/api/master/${activeTable}/${recordId}`, editingRecord, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: `${table.name} updated successfully`,
        });
        setIsEditDialogOpen(false);
        setEditingRecord(null);
        fetchTableData(activeTable);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || `Failed to update ${activeTable}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteRecord = async (recordId) => {
    const table = masterTables.find(t => t.key === activeTable);
    
    if (!window.confirm(`Are you sure you want to delete this ${table.name.toLowerCase()}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.delete(`${BACKEND_URL}/api/master/${activeTable}/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: `${table.name} deleted successfully`,
        });
        fetchTableData(activeTable);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || `Failed to delete ${activeTable}`,
        variant: "destructive",
      });
    }
  };

  const getCurrentTableConfig = () => {
    return masterTables.find(t => t.key === activeTable);
  };

  const generateColumns = (tableConfig) => {
    const columns = tableConfig.fields.map(field => ({
      key: field.key,
      header: field.label,
      sortable: true
    }));

    // Add status column
    columns.push({
      key: 'is_active',
      header: 'Status',
      render: (value) => (
        <Badge className={value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      )
    });

    // Add created date column
    columns.push({
      key: 'created_at',
      header: 'Created At',
      type: 'date',
      sortable: true
    });

    // Add actions column
    columns.push({
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
          <ProtectedComponent menuPath="/master" permission="edit">
            <Button variant="ghost" size="sm" onClick={() => handleEditRecord(record)}>
              <Edit className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
          <ProtectedComponent menuPath="/master" permission="delete">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-600 hover:text-red-800"
              onClick={() => handleDeleteRecord(record[tableConfig.primaryKey])}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
        </div>
      )
    });

    return columns;
  };

  const currentTable = getCurrentTableConfig();
  const currentData = masterData[activeTable] || [];
  const columns = currentTable ? generateColumns(currentTable) : [];

  const createRecordAction = (
    <ProtectedComponent menuPath="/master" permission="create">
      <Button 
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => setIsCreateDialogOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add {currentTable?.name}
      </Button>
    </ProtectedComponent>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Master Data Management</h2>
          <p className="text-slate-600">Manage system master data and reference tables</p>
        </div>
      </div>

      {/* Master Data Tables */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings2 className="mr-2 h-5 w-5 text-blue-600" />
            Master Data Tables
          </CardTitle>
          <CardDescription>
            Configure and manage all master data used throughout the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTable} onValueChange={setActiveTable}>
            {/* Scrollable horizontal tabs for all master tables */}
            <div className="relative mb-6">
              <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
                <div className="flex space-x-1 min-w-max">
                  {masterTables.map((table) => (
                    <TabsTrigger 
                      key={table.key} 
                      value={table.key} 
                      className="text-xs whitespace-nowrap px-3 py-2 flex-shrink-0"
                    >
                      {table.name}
                    </TabsTrigger>
                  ))}
                </div>
              </TabsList>
            </div>

            {masterTables.map((table) => (
              <TabsContent key={table.key} value={table.key}>
                <DataTable
                  data={currentData}
                  columns={columns}
                  title={table.name}
                  searchable={true}
                  exportable={true}
                  onRefresh={() => fetchTableData(activeTable)}
                  loading={loading}
                  actions={createRecordAction}
                  pageSize={10}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Record Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {currentTable?.name}</DialogTitle>
            <DialogDescription>Add a new {currentTable?.name.toLowerCase()} to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {currentTable?.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={`create-${field.key}`}>
                  {field.label} {field.required && '*'}
                </Label>
                <Input
                  id={`create-${field.key}`}
                  value={newRecord[field.key] || ''}
                  onChange={(e) => setNewRecord({ ...newRecord, [field.key]: e.target.value })}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRecord} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create {currentTable?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {currentTable?.name}</DialogTitle>
            <DialogDescription>Update {currentTable?.name.toLowerCase()} information</DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              {currentTable?.fields.map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`edit-${field.key}`}>
                    {field.label} {field.required && '*'}
                  </Label>
                  <Input
                    id={`edit-${field.key}`}
                    value={editingRecord[field.key] || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, [field.key]: e.target.value })}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRecord} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update {currentTable?.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterDataManagement;