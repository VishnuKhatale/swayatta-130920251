import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Building2, MapPin, Users2, TrendingUp, Eye, Edit, Trash2, FileText, DollarSign, Phone, X } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import DataTable from './DataTable';
import ProtectedComponent from './ProtectedComponent';
import axios from 'axios';

const CompaniesManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [masterData, setMasterData] = useState({
    companyTypes: [],
    partnerTypes: [],
    headOfCompany: [],
    addressTypes: [],
    countries: [],
    states: [],
    cities: [],
    documentTypes: [],
    currencies: [],
    jobFunctions: []
  });
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [viewingCompany, setViewingCompany] = useState(null);
  const [newCompany, setNewCompany] = useState({
    company_name: '',
    company_type_id: '',
    partner_type_id: '',
    head_of_company_id: '',
    gst_no: '',
    pan_no: '',
    is_active: true,
    addresses: [],
    documents: [],
    financials: [],
    contacts: []
  });
  const [activeTab, setActiveTab] = useState('basic');
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
        companiesRes, companyTypesRes, partnerTypesRes, headOfCompanyRes,
        addressTypesRes, countriesRes, documentTypesRes, currenciesRes, jobFunctionsRes
      ] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/companies`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/company-types`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/partner-types`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/head-of-company`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/address-types`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/countries`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/document-types`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/currencies`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/master/job-functions`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (companiesRes.data.success) {
        setCompanies(companiesRes.data.data);
      }
      
      setMasterData({
        companyTypes: companyTypesRes.data.success ? companyTypesRes.data.data : [],
        partnerTypes: partnerTypesRes.data.success ? partnerTypesRes.data.data : [],
        headOfCompany: headOfCompanyRes.data.success ? headOfCompanyRes.data.data : [],
        addressTypes: addressTypesRes.data.success ? addressTypesRes.data.data : [],
        countries: countriesRes.data.success ? countriesRes.data.data : [],
        states: [], // Will be loaded dynamically based on country
        cities: [], // Will be loaded dynamically based on state
        documentTypes: documentTypesRes.data.success ? documentTypesRes.data.data : [],
        currencies: currenciesRes.data.success ? currenciesRes.data.data : [],
        jobFunctions: jobFunctionsRes.data.success ? jobFunctionsRes.data.data : []
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

  const loadStates = async (countryId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${BACKEND_URL}/api/master/states`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const allStates = response.data.data;
        const countryStates = allStates.filter(state => state.country_id === countryId);
        setMasterData(prev => ({ ...prev, states: countryStates }));
      }
    } catch (error) {
      console.error('Failed to load states:', error);
    }
  };

  const loadCities = async (stateId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${BACKEND_URL}/api/master/cities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const allCities = response.data.data;
        const stateCities = allCities.filter(city => city.state_id === stateId);
        setMasterData(prev => ({ ...prev, cities: stateCities }));
      }
    } catch (error) {
      console.error('Failed to load cities:', error);
    }
  };

  const resetForm = () => {
    setNewCompany({
      company_name: '',
      company_type_id: '',
      partner_type_id: '',
      head_of_company_id: '',
      gst_no: '',
      pan_no: '',
      is_active: true,
      addresses: [],
      documents: [],
      financials: [],
      contacts: []
    });
    setActiveTab('basic');
  };

  const validateForm = (companyData, isEdit = false) => {
    // Basic validation
    const requiredFields = ['company_name', 'company_type_id', 'partner_type_id', 'head_of_company_id'];
    for (const field of requiredFields) {
      if (!companyData[field]) {
        toast({
          title: "Validation Error",
          description: `${field.replace('_', ' ')} is required`,
          variant: "destructive",
        });
        return false;
      }
    }

    // Validate contacts
    const primaryContacts = companyData.contacts.filter(contact => contact.is_primary);
    if (primaryContacts.length > 1) {
      toast({
        title: "Validation Error",
        description: "Only one primary contact is allowed per company",
        variant: "destructive",
      });
      return false;
    }

    // Validate contact emails
    for (const contact of companyData.contacts) {
      if (contact.email && !/\S+@\S+\.\S+/.test(contact.email)) {
        toast({
          title: "Validation Error",
          description: `Invalid email format: ${contact.email}`,
          variant: "destructive",
        });
        return false;
      }
    }

    // Validate financial data
    for (const financial of companyData.financials) {
      if (financial.revenue && (isNaN(financial.revenue) || financial.revenue < 0)) {
        toast({
          title: "Validation Error",
          description: "Revenue must be a positive number",
          variant: "destructive",
        });
        return false;
      }
      if (financial.year && (isNaN(financial.year) || financial.year < 1900 || financial.year > 2100)) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid year",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleCreateCompany = async () => {
    try {
      if (!validateForm(newCompany)) {
        return;
      }

      const token = localStorage.getItem('access_token');
      
      // Create company first
      const companyResponse = await axios.post(`${BACKEND_URL}/api/companies`, {
        company_name: newCompany.company_name,
        company_type_id: newCompany.company_type_id,
        partner_type_id: newCompany.partner_type_id,
        head_of_company_id: newCompany.head_of_company_id,
        gst_no: newCompany.gst_no,
        pan_no: newCompany.pan_no,
        is_active: newCompany.is_active
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (companyResponse.data.success) {
        const companyId = companyResponse.data.data.company_id;

        // Create nested entities
        await Promise.all([
          ...newCompany.addresses.map(address => 
            axios.post(`${BACKEND_URL}/api/companies/${companyId}/addresses`, address, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ),
          ...newCompany.documents.map(document => 
            axios.post(`${BACKEND_URL}/api/companies/${companyId}/documents`, document, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ),
          ...newCompany.financials.map(financial => 
            axios.post(`${BACKEND_URL}/api/companies/${companyId}/financials`, financial, {
              headers: { Authorization: `Bearer ${token}` }
            })
          ),
          ...newCompany.contacts.map(contact => 
            axios.post(`${BACKEND_URL}/api/companies/${companyId}/contacts`, contact, {
              headers: { Authorization: `Bearer ${token}` }
            })
          )
        ]);

        toast({
          title: "Success",
          description: "Company created successfully with all related data",
        });
        setIsCreateDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create company",
        variant: "destructive",
      });
    }
  };

  const handleEditCompany = async (company) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${BACKEND_URL}/api/companies/${company.company_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const companyData = response.data.data;
        setEditingCompany({
          ...companyData,
          addresses: companyData.addresses || [],
          documents: companyData.documents || [],
          financials: companyData.financials || [],
          contacts: companyData.contacts || []
        });
        setIsEditDialogOpen(true);
        setActiveTab('basic');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to fetch company details",
        variant: "destructive",
      });
    }
  };

  const handleUpdateCompany = async () => {
    try {
      if (!validateForm(editingCompany, true)) {
        return;
      }

      const token = localStorage.getItem('access_token');
      
      // Update company basic info
      await axios.put(`${BACKEND_URL}/api/companies/${editingCompany.company_id}`, {
        company_name: editingCompany.company_name,
        company_type_id: editingCompany.company_type_id,
        partner_type_id: editingCompany.partner_type_id,
        head_of_company_id: editingCompany.head_of_company_id,
        gst_no: editingCompany.gst_no,
        pan_no: editingCompany.pan_no,
        is_active: editingCompany.is_active
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Handle nested entities
      // For simplicity, we'll delete existing and recreate (in production, you'd want sophisticated sync)
      const companyId = editingCompany.company_id;

      // Get existing nested entities to delete them
      const [existingAddresses, existingDocuments, existingFinancials, existingContacts] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/companies/${companyId}/addresses`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/companies/${companyId}/documents`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/companies/${companyId}/financials`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${BACKEND_URL}/api/companies/${companyId}/contacts`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      // Delete existing nested entities
      const deletePromises = [];
      
      if (existingAddresses.data.success) {
        existingAddresses.data.data.forEach(address => {
          deletePromises.push(
            axios.delete(`${BACKEND_URL}/api/companies/${companyId}/addresses/${address.address_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
        });
      }

      if (existingDocuments.data.success) {
        existingDocuments.data.data.forEach(document => {
          deletePromises.push(
            axios.delete(`${BACKEND_URL}/api/companies/${companyId}/documents/${document.document_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
        });
      }

      if (existingFinancials.data.success) {
        existingFinancials.data.data.forEach(financial => {
          deletePromises.push(
            axios.delete(`${BACKEND_URL}/api/companies/${companyId}/financials/${financial.financial_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
        });
      }

      if (existingContacts.data.success) {
        existingContacts.data.data.forEach(contact => {
          deletePromises.push(
            axios.delete(`${BACKEND_URL}/api/companies/${companyId}/contacts/${contact.contact_id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          );
        });
      }

      // Wait for all deletions to complete
      await Promise.all(deletePromises);

      // Create new nested entities
      await Promise.all([
        ...editingCompany.addresses.map(address => 
          axios.post(`${BACKEND_URL}/api/companies/${companyId}/addresses`, address, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ),
        ...editingCompany.documents.map(document => 
          axios.post(`${BACKEND_URL}/api/companies/${companyId}/documents`, document, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ),
        ...editingCompany.financials.map(financial => 
          axios.post(`${BACKEND_URL}/api/companies/${companyId}/financials`, financial, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ),
        ...editingCompany.contacts.map(contact => 
          axios.post(`${BACKEND_URL}/api/companies/${companyId}/contacts`, contact, {
            headers: { Authorization: `Bearer ${token}` }
          })
        )
      ]);
      
      toast({
        title: "Success",
        description: "Company and all related data updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingCompany(null);
      setActiveTab('basic');
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update company",
        variant: "destructive",
      });
    }
  };

  // Nested entity management functions
  const addAddress = (isEdit = false) => {
    const newAddress = {
      address_type_id: '',
      address: '',
      country_id: '',
      state_id: '',
      city_id: '',
      zipcode: '',
      is_active: true
    };
    
    if (isEdit && editingCompany) {
      setEditingCompany({
        ...editingCompany,
        addresses: [...editingCompany.addresses, newAddress]
      });
    } else {
      setNewCompany({
        ...newCompany,
        addresses: [...newCompany.addresses, newAddress]
      });
    }
  };

  const removeAddress = (index, isEdit = false) => {
    if (isEdit && editingCompany) {
      const addresses = editingCompany.addresses.filter((_, i) => i !== index);
      setEditingCompany({ ...editingCompany, addresses });
    } else {
      const addresses = newCompany.addresses.filter((_, i) => i !== index);
      setNewCompany({ ...newCompany, addresses });
    }
  };

  const updateAddress = (index, field, value, isEdit = false) => {
    if (isEdit && editingCompany) {
      const addresses = [...editingCompany.addresses];
      addresses[index] = { ...addresses[index], [field]: value };
      setEditingCompany({ ...editingCompany, addresses });
    } else {
      const addresses = [...newCompany.addresses];
      addresses[index] = { ...addresses[index], [field]: value };
      setNewCompany({ ...newCompany, addresses });
    }

    // Load states when country changes
    if (field === 'country_id' && value) {
      loadStates(value);
    }
    // Load cities when state changes
    if (field === 'state_id' && value) {
      loadCities(value);
    }
  };

  const addDocument = (isEdit = false) => {
    const newDocument = {
      document_type_id: '',
      file_path: '',
      description: '',
      is_active: true
    };
    
    if (isEdit && editingCompany) {
      setEditingCompany({
        ...editingCompany,
        documents: [...editingCompany.documents, newDocument]
      });
    } else {
      setNewCompany({
        ...newCompany,
        documents: [...newCompany.documents, newDocument]
      });
    }
  };

  const removeDocument = (index, isEdit = false) => {
    if (isEdit && editingCompany) {
      const documents = editingCompany.documents.filter((_, i) => i !== index);
      setEditingCompany({ ...editingCompany, documents });
    } else {
      const documents = newCompany.documents.filter((_, i) => i !== index);
      setNewCompany({ ...newCompany, documents });
    }
  };

  const updateDocument = (index, field, value, isEdit = false) => {
    if (isEdit && editingCompany) {
      const documents = [...editingCompany.documents];
      documents[index] = { ...documents[index], [field]: value };
      setEditingCompany({ ...editingCompany, documents });
    } else {
      const documents = [...newCompany.documents];
      documents[index] = { ...documents[index], [field]: value };
      setNewCompany({ ...newCompany, documents });
    }
  };

  const addFinancial = (isEdit = false) => {
    const newFinancial = {
      year: new Date().getFullYear(),
      revenue: '',
      profit: '',
      currency_id: '',
      type: 'Annual',
      is_active: true
    };
    
    if (isEdit && editingCompany) {
      setEditingCompany({
        ...editingCompany,
        financials: [...editingCompany.financials, newFinancial]
      });
    } else {
      setNewCompany({
        ...newCompany,
        financials: [...newCompany.financials, newFinancial]
      });
    }
  };

  const removeFinancial = (index, isEdit = false) => {
    if (isEdit && editingCompany) {
      const financials = editingCompany.financials.filter((_, i) => i !== index);
      setEditingCompany({ ...editingCompany, financials });
    } else {
      const financials = newCompany.financials.filter((_, i) => i !== index);
      setNewCompany({ ...newCompany, financials });
    }
  };

  const updateFinancial = (index, field, value, isEdit = false) => {
    if (isEdit && editingCompany) {
      const financials = [...editingCompany.financials];
      financials[index] = { ...financials[index], [field]: value };
      setEditingCompany({ ...editingCompany, financials });
    } else {
      const financials = [...newCompany.financials];
      financials[index] = { ...financials[index], [field]: value };
      setNewCompany({ ...newCompany, financials });
    }
  };

  const addContact = (isEdit = false) => {
    const newContact = {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      designation_id: '',
      department: '',
      is_primary: false,
      is_active: true
    };
    
    if (isEdit && editingCompany) {
      setEditingCompany({
        ...editingCompany,
        contacts: [...editingCompany.contacts, newContact]
      });
    } else {
      setNewCompany({
        ...newCompany,
        contacts: [...newCompany.contacts, newContact]
      });
    }
  };

  const removeContact = (index, isEdit = false) => {
    if (isEdit && editingCompany) {
      const contacts = editingCompany.contacts.filter((_, i) => i !== index);
      setEditingCompany({ ...editingCompany, contacts });
    } else {
      const contacts = newCompany.contacts.filter((_, i) => i !== index);
      setNewCompany({ ...newCompany, contacts });
    }
  };

  const updateContact = (index, field, value, isEdit = false) => {
    if (isEdit && editingCompany) {
      const contacts = [...editingCompany.contacts];
      
      // If setting as primary, unset others
      if (field === 'is_primary' && value) {
        contacts.forEach((contact, i) => {
          if (i !== index) contacts[i].is_primary = false;
        });
      }
      
      contacts[index] = { ...contacts[index], [field]: value };
      setEditingCompany({ ...editingCompany, contacts });
    } else {
      const contacts = [...newCompany.contacts];
      
      // If setting as primary, unset others
      if (field === 'is_primary' && value) {
        contacts.forEach((contact, i) => {
          if (i !== index) contacts[i].is_primary = false;
        });
      }
      
      contacts[index] = { ...contacts[index], [field]: value };
      setNewCompany({ ...newCompany, contacts });
    }
  };

  const handleViewCompany = async (company) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${BACKEND_URL}/api/companies/${company.company_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setViewingCompany(response.data.data);
        setIsViewDialogOpen(true);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to fetch company details",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company? This will also delete all related addresses, documents, financials, and contacts.')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.delete(`${BACKEND_URL}/api/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Company and related data deleted successfully",
        });
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete company",
        variant: "destructive",
      });
    }
  };

  const handleExportCompanies = (data) => {
    const headers = ['Company Name', 'Company Type', 'Partner Type', 'Head of Company', 'GST No', 'PAN No', 'Status', 'Addresses', 'Documents', 'Financials', 'Contacts', 'Created At'];
    const rows = data.map(company => [
      company.company_name,
      company.company_type_name,
      company.partner_type_name,
      company.head_of_company_name,
      company.gst_no || '',
      company.pan_no || '',
      company.is_active ? 'Active' : 'Inactive',
      company.addresses_count || 0,
      company.documents_count || 0,
      company.financials_count || 0,
      company.contacts_count || 0,
      new Date(company.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'companies_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const companyColumns = [
    {
      key: 'company_name',
      header: 'Company Name',
      sortable: true
    },
    {
      key: 'company_type_name',
      header: 'Company Type',
      render: (value) => (
        <Badge variant="secondary">{value}</Badge>
      )
    },
    {
      key: 'partner_type_name',
      header: 'Partner Type',
      render: (value) => (
        <Badge variant="outline">{value}</Badge>
      )
    },
    {
      key: 'head_of_company_name',
      header: 'Head of Company',
      render: (value) => (
        <Badge className="bg-blue-100 text-blue-800">{value}</Badge>
      )
    },
    {
      key: 'gst_no',
      header: 'GST No',
      render: (value) => value || '-'
    },
    {
      key: 'pan_no',
      header: 'PAN No',
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
      key: 'nested_counts',
      header: 'Related Data',
      sortable: false,
      render: (_, company) => (
        <div className="flex space-x-1 text-xs">
          <Badge variant="outline" className="text-blue-600">
            📍 {company.addresses_count || 0}
          </Badge>
          <Badge variant="outline" className="text-green-600">
            📄 {company.documents_count || 0}
          </Badge>
          <Badge variant="outline" className="text-purple-600">
            💰 {company.financials_count || 0}
          </Badge>
          <Badge variant="outline" className="text-orange-600">
            👥 {company.contacts_count || 0}
          </Badge>
        </div>
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
      render: (_, company) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => handleViewCompany(company)}>
            <Eye className="h-4 w-4" />
          </Button>
          <ProtectedComponent menuPath="/companies" permission="edit">
            <Button variant="ghost" size="sm" onClick={() => handleEditCompany(company)}>
              <Edit className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
          <ProtectedComponent menuPath="/companies" permission="delete">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-600 hover:text-red-800"
              onClick={() => handleDeleteCompany(company.company_id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
        </div>
      )
    }
  ];

  const createCompanyAction = (
    <ProtectedComponent menuPath="/companies" permission="create">
      <Button 
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => setIsCreateDialogOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Company
      </Button>
    </ProtectedComponent>
  );

  // Calculate stats
  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => c.is_active).length;
  const totalAddresses = companies.reduce((sum, c) => sum + (c.addresses_count || 0), 0);
  const thisMonthCompanies = companies.filter(c => {
    const created = new Date(c.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Companies Management</h2>
          <p className="text-slate-600">Manage client companies and business entities</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalCompanies}</div>
            <p className="text-xs text-slate-600 mt-1">All companies</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <Users2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCompanies}</div>
            <p className="text-xs text-slate-600 mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Addresses</CardTitle>
            <MapPin className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalAddresses}</div>
            <p className="text-xs text-slate-600 mt-1">Across all companies</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{thisMonthCompanies}</div>
            <p className="text-xs text-slate-600 mt-1">New companies</p>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <DataTable
        data={companies}
        columns={companyColumns}
        title="Companies"
        searchable={true}
        exportable={true}
        onExport={handleExportCompanies}
        onRefresh={fetchData}
        loading={loading}
        actions={createCompanyAction}
        pageSize={10}
      />

      {/* Create Company Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>Add a new company with all related information</DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="addresses" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Addresses ({newCompany.addresses.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents ({newCompany.documents.length})
              </TabsTrigger>
              <TabsTrigger value="financials" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financials ({newCompany.financials.length})
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contacts ({newCompany.contacts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div>
                <Label htmlFor="create-company-name">Company Name *</Label>
                <Input
                  id="create-company-name"
                  value={newCompany.company_name}
                  onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                  placeholder="Enter company name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-gst-no">GST Number</Label>
                  <Input
                    id="create-gst-no"
                    value={newCompany.gst_no}
                    onChange={(e) => setNewCompany({ ...newCompany, gst_no: e.target.value })}
                    placeholder="Enter GST number"
                  />
                </div>
                <div>
                  <Label htmlFor="create-pan-no">PAN Number</Label>
                  <Input
                    id="create-pan-no"
                    value={newCompany.pan_no}
                    onChange={(e) => setNewCompany({ ...newCompany, pan_no: e.target.value })}
                    placeholder="Enter PAN number"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="create-company-type">Company Type *</Label>
                <Select value={newCompany.company_type_id} onValueChange={(value) => setNewCompany({ ...newCompany, company_type_id: value })}>
                  <SelectTrigger>
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
                <Select value={newCompany.partner_type_id} onValueChange={(value) => setNewCompany({ ...newCompany, partner_type_id: value })}>
                  <SelectTrigger>
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
              <div>
                <Label htmlFor="create-head-of-company">Head of Company *</Label>
                <Select value={newCompany.head_of_company_id} onValueChange={(value) => setNewCompany({ ...newCompany, head_of_company_id: value })}>
                  <SelectTrigger>
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-is-active"
                  checked={newCompany.is_active}
                  onCheckedChange={(checked) => setNewCompany({ ...newCompany, is_active: checked })}
                />
                <Label htmlFor="create-is-active">Active Company</Label>
              </div>
            </TabsContent>

            <TabsContent value="addresses" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium">Company Addresses</h4>
                <Button onClick={() => addAddress(false)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Address
                </Button>
              </div>
              
              {newCompany.addresses.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No addresses added yet</p>
              ) : (
                newCompany.addresses.map((address, index) => (
                  <Card key={index} className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                      onClick={() => removeAddress(index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Address Type *</Label>
                          <Select value={address.address_type_id} onValueChange={(value) => updateAddress(index, 'address_type_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select address type" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.addressTypes.map((type) => (
                                <SelectItem key={type.address_type_id} value={type.address_type_id}>
                                  {type.address_type_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Country *</Label>
                          <Select value={address.country_id} onValueChange={(value) => updateAddress(index, 'country_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.countries.map((country) => (
                                <SelectItem key={country.country_id} value={country.country_id}>
                                  {country.country_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>State *</Label>
                          <Select value={address.state_id} onValueChange={(value) => updateAddress(index, 'state_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.states.map((state) => (
                                <SelectItem key={state.state_id} value={state.state_id}>
                                  {state.state_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>City *</Label>
                          <Select value={address.city_id} onValueChange={(value) => updateAddress(index, 'city_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.cities.map((city) => (
                                <SelectItem key={city.city_id} value={city.city_id}>
                                  {city.city_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label>Address *</Label>
                          <Textarea
                            value={address.address}
                            onChange={(e) => updateAddress(index, 'address', e.target.value, false)}
                            placeholder="Enter address"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Zipcode</Label>
                          <Input
                            value={address.zipcode}
                            onChange={(e) => updateAddress(index, 'zipcode', e.target.value, false)}
                            placeholder="Enter zipcode"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={address.is_active}
                            onCheckedChange={(checked) => updateAddress(index, 'is_active', checked, false)}
                          />
                          <Label>Active Address</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium">Company Documents</h4>
                <Button onClick={() => addDocument(false)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Document
                </Button>
              </div>
              
              {newCompany.documents.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No documents added yet</p>
              ) : (
                newCompany.documents.map((document, index) => (
                  <Card key={index} className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                      onClick={() => removeDocument(index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Document Type *</Label>
                          <Select value={document.document_type_id} onValueChange={(value) => updateDocument(index, 'document_type_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.documentTypes.map((type) => (
                                <SelectItem key={type.document_type_id} value={type.document_type_id}>
                                  {type.document_type_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>File Path *</Label>
                          <Input
                            value={document.file_path}
                            onChange={(e) => updateDocument(index, 'file_path', e.target.value, false)}
                            placeholder="Enter file path or URL"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            value={document.description}
                            onChange={(e) => updateDocument(index, 'description', e.target.value, false)}
                            placeholder="Enter document description"
                            rows={3}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={document.is_active}
                            onCheckedChange={(checked) => updateDocument(index, 'is_active', checked, false)}
                          />
                          <Label>Active Document</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="financials" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium">Financial Records</h4>
                <Button onClick={() => addFinancial(false)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Financial Record
                </Button>
              </div>
              
              {newCompany.financials.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No financial records added yet</p>
              ) : (
                newCompany.financials.map((financial, index) => (
                  <Card key={index} className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                      onClick={() => removeFinancial(index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Year *</Label>
                          <Input
                            type="number"
                            value={financial.year}
                            onChange={(e) => updateFinancial(index, 'year', parseInt(e.target.value), false)}
                            placeholder="Enter year"
                            min="1900"
                            max="2100"
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Select value={financial.type} onValueChange={(value) => updateFinancial(index, 'type', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Annual">Annual</SelectItem>
                              <SelectItem value="Quarterly">Quarterly</SelectItem>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Currency *</Label>
                          <Select value={financial.currency_id} onValueChange={(value) => updateFinancial(index, 'currency_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.currencies.map((currency) => (
                                <SelectItem key={currency.currency_id} value={currency.currency_id}>
                                  {currency.currency_name} ({currency.currency_symbol})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Revenue</Label>
                          <Input
                            type="number"
                            value={financial.revenue}
                            onChange={(e) => updateFinancial(index, 'revenue', parseFloat(e.target.value) || '', false)}
                            placeholder="Enter revenue amount"
                            min="0"
                          />
                        </div>
                        <div>
                          <Label>Profit</Label>
                          <Input
                            type="number"
                            value={financial.profit}
                            onChange={(e) => updateFinancial(index, 'profit', parseFloat(e.target.value) || '', false)}
                            placeholder="Enter profit amount"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={financial.is_active}
                            onCheckedChange={(checked) => updateFinancial(index, 'is_active', checked, false)}
                          />
                          <Label>Active Record</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium">Company Contacts</h4>
                <Button onClick={() => addContact(false)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </div>
              
              {newCompany.contacts.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No contacts added yet</p>
              ) : (
                newCompany.contacts.map((contact, index) => (
                  <Card key={index} className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                      onClick={() => removeContact(index, false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>First Name *</Label>
                          <Input
                            value={contact.first_name}
                            onChange={(e) => updateContact(index, 'first_name', e.target.value, false)}
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <Label>Last Name *</Label>
                          <Input
                            value={contact.last_name}
                            onChange={(e) => updateContact(index, 'last_name', e.target.value, false)}
                            placeholder="Enter last name"
                          />
                        </div>
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={contact.email}
                            onChange={(e) => updateContact(index, 'email', e.target.value, false)}
                            placeholder="Enter email address"
                          />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input
                            value={contact.phone}
                            onChange={(e) => updateContact(index, 'phone', e.target.value, false)}
                            placeholder="Enter phone number"
                          />
                        </div>
                        <div>
                          <Label>Mobile</Label>
                          <Input
                            value={contact.mobile}
                            onChange={(e) => updateContact(index, 'mobile', e.target.value, false)}
                            placeholder="Enter mobile number"
                          />
                        </div>
                        <div>
                          <Label>Designation</Label>
                          <Select value={contact.designation_id} onValueChange={(value) => updateContact(index, 'designation_id', value, false)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select designation" />
                            </SelectTrigger>
                            <SelectContent>
                              {masterData.jobFunctions.map((job) => (
                                <SelectItem key={job.job_function_id} value={job.job_function_id}>
                                  {job.job_function_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Department</Label>
                          <Input
                            value={contact.department}
                            onChange={(e) => updateContact(index, 'department', e.target.value, false)}
                            placeholder="Enter department"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={contact.is_primary}
                            onCheckedChange={(checked) => updateContact(index, 'is_primary', checked, false)}
                          />
                          <Label>Primary Contact</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={contact.is_active}
                            onCheckedChange={(checked) => updateContact(index, 'is_active', checked, false)}
                          />
                          <Label>Active Contact</Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateCompany} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company information and related data</DialogDescription>
          </DialogHeader>
          
          {editingCompany && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="addresses" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Addresses ({editingCompany.addresses?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents ({editingCompany.documents?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="financials" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financials ({editingCompany.financials?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="contacts" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Contacts ({editingCompany.contacts?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div>
                  <Label htmlFor="edit-company-name">Company Name *</Label>
                  <Input
                    id="edit-company-name"
                    value={editingCompany.company_name}
                    onChange={(e) => setEditingCompany({ ...editingCompany, company_name: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-gst-no">GST Number</Label>
                    <Input
                      id="edit-gst-no"
                      value={editingCompany.gst_no || ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, gst_no: e.target.value })}
                      placeholder="Enter GST number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-pan-no">PAN Number</Label>
                    <Input
                      id="edit-pan-no"
                      value={editingCompany.pan_no || ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, pan_no: e.target.value })}
                      placeholder="Enter PAN number"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-company-type">Company Type *</Label>
                  <Select value={editingCompany.company_type_id} onValueChange={(value) => setEditingCompany({ ...editingCompany, company_type_id: value })}>
                    <SelectTrigger>
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
                  <Select value={editingCompany.partner_type_id} onValueChange={(value) => setEditingCompany({ ...editingCompany, partner_type_id: value })}>
                    <SelectTrigger>
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
                <div>
                  <Label htmlFor="edit-head-of-company">Head of Company *</Label>
                  <Select value={editingCompany.head_of_company_id} onValueChange={(value) => setEditingCompany({ ...editingCompany, head_of_company_id: value })}>
                    <SelectTrigger>
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
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-is-active"
                    checked={editingCompany.is_active}
                    onCheckedChange={(checked) => setEditingCompany({ ...editingCompany, is_active: checked })}
                  />
                  <Label htmlFor="edit-is-active">Active Company</Label>
                </div>
              </TabsContent>

              <TabsContent value="addresses" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium">Company Addresses</h4>
                  <Button onClick={() => addAddress(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Address
                  </Button>
                </div>
                
                {editingCompany.addresses?.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No addresses added yet</p>
                ) : (
                  editingCompany.addresses?.map((address, index) => (
                    <Card key={index} className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                        onClick={() => removeAddress(index, true)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Address Type *</Label>
                            <Select value={address.address_type_id} onValueChange={(value) => updateAddress(index, 'address_type_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select address type" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.addressTypes.map((type) => (
                                  <SelectItem key={type.address_type_id} value={type.address_type_id}>
                                    {type.address_type_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Country *</Label>
                            <Select value={address.country_id} onValueChange={(value) => updateAddress(index, 'country_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.countries.map((country) => (
                                  <SelectItem key={country.country_id} value={country.country_id}>
                                    {country.country_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>State *</Label>
                            <Select value={address.state_id} onValueChange={(value) => updateAddress(index, 'state_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.states.map((state) => (
                                  <SelectItem key={state.state_id} value={state.state_id}>
                                    {state.state_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>City *</Label>
                            <Select value={address.city_id} onValueChange={(value) => updateAddress(index, 'city_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select city" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.cities.map((city) => (
                                  <SelectItem key={city.city_id} value={city.city_id}>
                                    {city.city_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label>Address *</Label>
                            <Textarea
                              value={address.address}
                              onChange={(e) => updateAddress(index, 'address', e.target.value, true)}
                              placeholder="Enter address"
                              rows={3}
                            />
                          </div>
                          <div>
                            <Label>Zipcode</Label>
                            <Input
                              value={address.zipcode}
                              onChange={(e) => updateAddress(index, 'zipcode', e.target.value, true)}
                              placeholder="Enter zipcode"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={address.is_active}
                              onCheckedChange={(checked) => updateAddress(index, 'is_active', checked, true)}
                            />
                            <Label>Active Address</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium">Company Documents</h4>
                  <Button onClick={() => addDocument(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Document
                  </Button>
                </div>
                
                {editingCompany.documents?.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No documents added yet</p>
                ) : (
                  editingCompany.documents?.map((document, index) => (
                    <Card key={index} className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                        onClick={() => removeDocument(index, true)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Document Type *</Label>
                            <Select value={document.document_type_id} onValueChange={(value) => updateDocument(index, 'document_type_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select document type" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.documentTypes.map((type) => (
                                  <SelectItem key={type.document_type_id} value={type.document_type_id}>
                                    {type.document_type_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>File Path *</Label>
                            <Input
                              value={document.file_path}
                              onChange={(e) => updateDocument(index, 'file_path', e.target.value, true)}
                              placeholder="Enter file path or URL"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              value={document.description}
                              onChange={(e) => updateDocument(index, 'description', e.target.value, true)}
                              placeholder="Enter document description"
                              rows={3}
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={document.is_active}
                              onCheckedChange={(checked) => updateDocument(index, 'is_active', checked, true)}
                            />
                            <Label>Active Document</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="financials" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium">Financial Records</h4>
                  <Button onClick={() => addFinancial(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Financial Record
                  </Button>
                </div>
                
                {editingCompany.financials?.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No financial records added yet</p>
                ) : (
                  editingCompany.financials?.map((financial, index) => (
                    <Card key={index} className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                        onClick={() => removeFinancial(index, true)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Year *</Label>
                            <Input
                              type="number"
                              value={financial.year}
                              onChange={(e) => updateFinancial(index, 'year', parseInt(e.target.value), true)}
                              placeholder="Enter year"
                              min="1900"
                              max="2100"
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Select value={financial.type} onValueChange={(value) => updateFinancial(index, 'type', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Annual">Annual</SelectItem>
                                <SelectItem value="Quarterly">Quarterly</SelectItem>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Currency *</Label>
                            <Select value={financial.currency_id} onValueChange={(value) => updateFinancial(index, 'currency_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.currencies.map((currency) => (
                                  <SelectItem key={currency.currency_id} value={currency.currency_id}>
                                    {currency.currency_name} ({currency.currency_symbol})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Revenue</Label>
                            <Input
                              type="number"
                              value={financial.revenue}
                              onChange={(e) => updateFinancial(index, 'revenue', parseFloat(e.target.value) || '', true)}
                              placeholder="Enter revenue amount"
                              min="0"
                            />
                          </div>
                          <div>
                            <Label>Profit</Label>
                            <Input
                              type="number"
                              value={financial.profit}
                              onChange={(e) => updateFinancial(index, 'profit', parseFloat(e.target.value) || '', true)}
                              placeholder="Enter profit amount"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={financial.is_active}
                              onCheckedChange={(checked) => updateFinancial(index, 'is_active', checked, true)}
                            />
                            <Label>Active Record</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-medium">Company Contacts</h4>
                  <Button onClick={() => addContact(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </div>
                
                {editingCompany.contacts?.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No contacts added yet</p>
                ) : (
                  editingCompany.contacts?.map((contact, index) => (
                    <Card key={index} className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                        onClick={() => removeContact(index, true)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>First Name *</Label>
                            <Input
                              value={contact.first_name}
                              onChange={(e) => updateContact(index, 'first_name', e.target.value, true)}
                              placeholder="Enter first name"
                            />
                          </div>
                          <div>
                            <Label>Last Name *</Label>
                            <Input
                              value={contact.last_name}
                              onChange={(e) => updateContact(index, 'last_name', e.target.value, true)}
                              placeholder="Enter last name"
                            />
                          </div>
                          <div>
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              value={contact.email}
                              onChange={(e) => updateContact(index, 'email', e.target.value, true)}
                              placeholder="Enter email address"
                            />
                          </div>
                          <div>
                            <Label>Phone</Label>
                            <Input
                              value={contact.phone}
                              onChange={(e) => updateContact(index, 'phone', e.target.value, true)}
                              placeholder="Enter phone number"
                            />
                          </div>
                          <div>
                            <Label>Mobile</Label>
                            <Input
                              value={contact.mobile}
                              onChange={(e) => updateContact(index, 'mobile', e.target.value, true)}
                              placeholder="Enter mobile number"
                            />
                          </div>
                          <div>
                            <Label>Designation</Label>
                            <Select value={contact.designation_id} onValueChange={(value) => updateContact(index, 'designation_id', value, true)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select designation" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.jobFunctions.map((job) => (
                                  <SelectItem key={job.job_function_id} value={job.job_function_id}>
                                    {job.job_function_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Department</Label>
                            <Input
                              value={contact.department}
                              onChange={(e) => updateContact(index, 'department', e.target.value, true)}
                              placeholder="Enter department"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={contact.is_primary}
                              onCheckedChange={(checked) => updateContact(index, 'is_primary', checked, true)}
                            />
                            <Label>Primary Contact</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={contact.is_active}
                              onCheckedChange={(checked) => updateContact(index, 'is_active', checked, true)}
                            />
                            <Label>Active Contact</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingCompany(null); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCompany} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Company Dialog with Nested Data */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
            <DialogDescription>Complete company information with related data</DialogDescription>
          </DialogHeader>
          {viewingCompany && (
            <div className="space-y-6">
              {/* Basic Company Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="mr-2 h-5 w-5" />
                    {viewingCompany.company_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Company Type</p>
                      <p className="text-sm">{viewingCompany.company_type_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Partner Type</p>
                      <p className="text-sm">{viewingCompany.partner_type_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Head of Company</p>
                      <p className="text-sm">{viewingCompany.head_of_company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Status</p>
                      <Badge className={viewingCompany.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {viewingCompany.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {viewingCompany.gst_no && (
                      <div>
                        <p className="text-sm font-medium text-slate-600">GST Number</p>
                        <p className="text-sm">{viewingCompany.gst_no}</p>
                      </div>
                    )}
                    {viewingCompany.pan_no && (
                      <div>
                        <p className="text-sm font-medium text-slate-600">PAN Number</p>
                        <p className="text-sm">{viewingCompany.pan_no}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Nested Data Tabs */}
              <Tabs defaultValue="addresses" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="addresses" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Addresses ({viewingCompany.addresses?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents ({viewingCompany.documents?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="financials" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Financials ({viewingCompany.financials?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contacts ({viewingCompany.contacts?.length || 0})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="addresses" className="space-y-4">
                  {viewingCompany.addresses?.length > 0 ? (
                    viewingCompany.addresses.map((address, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-600">Address Type</p>
                              <p className="text-sm">{address.address_type_name}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Address</p>
                              <p className="text-sm">{address.address}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Location</p>
                              <p className="text-sm">{address.city_name}, {address.state_name}, {address.country_name}</p>
                            </div>
                            {address.zipcode && (
                              <div>
                                <p className="text-sm font-medium text-slate-600">Zipcode</p>
                                <p className="text-sm">{address.zipcode}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8">No addresses found</p>
                  )}
                </TabsContent>
                
                <TabsContent value="documents" className="space-y-4">
                  {viewingCompany.documents?.length > 0 ? (
                    viewingCompany.documents.map((document, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-600">Document Type</p>
                              <p className="text-sm">{document.document_type_name}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">File Path</p>
                              <p className="text-sm">{document.file_path}</p>
                            </div>
                            {document.description && (
                              <div className="col-span-2">
                                <p className="text-sm font-medium text-slate-600">Description</p>
                                <p className="text-sm">{document.description}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8">No documents found</p>
                  )}
                </TabsContent>
                
                <TabsContent value="financials" className="space-y-4">
                  {viewingCompany.financials?.length > 0 ? (
                    viewingCompany.financials.map((financial, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-600">Year</p>
                              <p className="text-sm">{financial.year}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Type</p>
                              <p className="text-sm">{financial.type}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Currency</p>
                              <p className="text-sm">{financial.currency_name} ({financial.currency_symbol})</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Revenue</p>
                              <p className="text-sm">{financial.revenue ? `${financial.currency_symbol}${financial.revenue.toLocaleString()}` : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Profit</p>
                              <p className="text-sm">{financial.profit ? `${financial.currency_symbol}${financial.profit.toLocaleString()}` : 'N/A'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8">No financial records found</p>
                  )}
                </TabsContent>
                
                <TabsContent value="contacts" className="space-y-4">
                  {viewingCompany.contacts?.length > 0 ? (
                    viewingCompany.contacts.map((contact, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-slate-600">Name</p>
                              <p className="text-sm">{contact.first_name} {contact.last_name}</p>
                              {contact.is_primary && <Badge className="mt-1 bg-blue-100 text-blue-800">Primary Contact</Badge>}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-600">Email</p>
                              <p className="text-sm">{contact.email}</p>
                            </div>
                            {contact.phone && (
                              <div>
                                <p className="text-sm font-medium text-slate-600">Phone</p>
                                <p className="text-sm">{contact.phone}</p>
                              </div>
                            )}
                            {contact.mobile && (
                              <div>
                                <p className="text-sm font-medium text-slate-600">Mobile</p>
                                <p className="text-sm">{contact.mobile}</p>
                              </div>
                            )}
                            {contact.designation_name && (
                              <div>
                                <p className="text-sm font-medium text-slate-600">Designation</p>
                                <p className="text-sm">{contact.designation_name}</p>
                              </div>
                            )}
                            {contact.department && (
                              <div>
                                <p className="text-sm font-medium text-slate-600">Department</p>
                                <p className="text-sm">{contact.department}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8">No contacts found</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompaniesManagement;