import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  Target,
  TrendingUp,
  Users,
  Award,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import axios from 'axios';
import DataTable from './DataTable';
import ProtectedComponent from './ProtectedComponent';

const LeadManagement = () => {
  // State management
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [statistics, setStatistics] = useState({
    totalLeads: 0,
    pendingLeads: 0,
    approvedLeads: 0,
    thisMonth: 0
  });

  // Master data state
  const [masterData, setMasterData] = useState({
    companies: [],
    leadSubtypes: [],
    leadSources: [],
    currencies: [],
    users: [],
    tenderSubtypes: [],
    submissionTypes: [],
    clauses: [],
    competitors: [],
    designations: [],
    billingTypes: []
  });

  // Form state for stepper
  const [leadFormData, setLeadFormData] = useState({
    // General Lead Details
    project_title: '',
    lead_subtype_id: '',
    lead_source_id: '',
    company_id: '',
    project_description: '',
    project_start_date: '',
    project_end_date: '',
    
    // Contact Details
    contacts: [{
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      designation_id: '',
      department: '',
      is_primary: true,
      is_decision_maker: false,
      decision_maker_percentage: 0
    }],
    
    // Tender Details (mandatory if subtype = Tender/Pre-tender)
    tender: {
      tender_subtype_id: '',
      submission_type_id: '',
      tender_number: '',
      tender_value: '',
      tender_currency_id: '',
      tender_description: '',
      dates: [{
        date_type: 'submission',
        date_value: '',
        description: ''
      }],
      clauses: [{
        clause_id: '',
        clause_value: '',
        clause_notes: ''
      }]
    },
    
    // Other Details
    expected_revenue: '',
    revenue_currency_id: '',
    convert_to_opportunity_date: '',
    assigned_to_user_id: '',
    decision_maker_percentage: '',
    competitors: [{
      competitor_id: '',
      competitor_strength: 'Medium',
      competitive_notes: ''
    }],
    documents: [{
      document_type_id: '',
      document_name: '',
      file_path: '',
      document_description: ''
    }],
    notes: ''
  });

  // Form validation state
  const [validationErrors, setValidationErrors] = useState({});

  // API configuration
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token'); // Match the key used in App.js
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Load data on component mount
  useEffect(() => {
    fetchLeads();
    fetchMasterData();
    fetchStatistics();
  }, []);

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/leads`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setLeads(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  // Fetch master data
  const fetchMasterData = async () => {
    try {
      const endpoints = [
        'companies',
        'master/lead-subtypes',
        'master/lead-sources',
        'master/currencies',
        'users',
        'master/tender-subtypes',
        'master/submission-types',
        'master/clauses',
        'master/competitors',
        'master/designations',
        'master/billing-types'
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint =>
          axios.get(`${API_BASE_URL}/api/${endpoint}`, {
            headers: getAuthHeaders()
          })
        )
      );

      const [
        companiesRes,
        leadSubtypesRes,
        leadSourcesRes,
        currenciesRes,
        usersRes,
        tenderSubtypesRes,
        submissionTypesRes,
        clausesRes,
        competitorsRes,
        designationsRes,
        billingTypesRes
      ] = responses;

      setMasterData({
        companies: companiesRes.data.success ? companiesRes.data.data : [],
        leadSubtypes: leadSubtypesRes.data.success ? leadSubtypesRes.data.data : [],
        leadSources: leadSourcesRes.data.success ? leadSourcesRes.data.data : [],
        currencies: currenciesRes.data.success ? currenciesRes.data.data : [],
        users: usersRes.data.success ? usersRes.data.data : [],
        tenderSubtypes: tenderSubtypesRes.data.success ? tenderSubtypesRes.data.data : [],
        submissionTypes: submissionTypesRes.data.success ? submissionTypesRes.data.data : [],
        clauses: clausesRes.data.success ? clausesRes.data.data : [],
        competitors: competitorsRes.data.success ? competitorsRes.data.data : [],
        designations: designationsRes.data.success ? designationsRes.data.data : [],
        billingTypes: billingTypesRes.data.success ? billingTypesRes.data.data : []
      });
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Failed to fetch master data');
    }
  };

  // Fetch statistics
  const fetchStatistics = () => {
    const totalLeads = leads.length;
    const pendingLeads = leads.filter(lead => lead.approval_status === 'pending').length;
    const approvedLeads = leads.filter(lead => lead.approval_status === 'approved').length;
    const currentDate = new Date();
    const thisMonth = leads.filter(lead => {
      const leadDate = new Date(lead.created_at);
      return leadDate.getMonth() === currentDate.getMonth() && 
             leadDate.getFullYear() === currentDate.getFullYear();
    }).length;

    setStatistics({
      totalLeads,
      pendingLeads,
      approvedLeads,
      thisMonth
    });
  };

  // Update statistics when leads change
  useEffect(() => {
    fetchStatistics();
  }, [leads]);

  // Stepper configuration
  const steps = [
    {
      id: 0,
      title: 'General Details',
      description: 'Project and company information',
      icon: <Building className="h-4 w-4" />
    },
    {
      id: 1,
      title: 'Contact Details',
      description: 'Customer contact information',
      icon: <Users className="h-4 w-4" />
    },
    {
      id: 2,
      title: 'Tender Details',
      description: 'Tender and submission details',
      icon: <FileText className="h-4 w-4" />
    },
    {
      id: 3,
      title: 'Other Details',
      description: 'Revenue and additional information',
      icon: <DollarSign className="h-4 w-4" />
    }
  ];

  // Check if tender details are mandatory
  const isTenderMandatory = useMemo(() => {
    const selectedSubtype = masterData.leadSubtypes.find(
      subtype => subtype.id === leadFormData.lead_subtype_id
    );
    return selectedSubtype && 
           (selectedSubtype.lead_subtype_name === 'Tender' || 
            selectedSubtype.lead_subtype_name === 'Pretender');
  }, [leadFormData.lead_subtype_id, masterData.leadSubtypes]);

  // Validation functions
  const validateStep = (stepIndex) => {
    const errors = {};
    
    switch (stepIndex) {
      case 0: // General Details
        if (!leadFormData.project_title.trim()) {
          errors.project_title = 'Project title is required';
        }
        if (!leadFormData.lead_subtype_id) {
          errors.lead_subtype_id = 'Lead subtype is required';
        }
        if (!leadFormData.lead_source_id) {
          errors.lead_source_id = 'Lead source is required';
        }
        if (!leadFormData.company_id) {
          errors.company_id = 'Company is required';
        }
        break;
        
      case 1: // Contact Details
        if (leadFormData.contacts.length === 0) {
          errors.contacts = 'At least one contact is required';
        } else {
          leadFormData.contacts.forEach((contact, index) => {
            if (!contact.first_name.trim()) {
              errors[`contact_${index}_first_name`] = 'First name is required';
            }
            if (!contact.last_name.trim()) {
              errors[`contact_${index}_last_name`] = 'Last name is required';
            }
            if (!contact.email.trim()) {
              errors[`contact_${index}_email`] = 'Email is required';
            } else if (!/\S+@\S+\.\S+/.test(contact.email)) {
              errors[`contact_${index}_email`] = 'Email is invalid';
            }
            if (!contact.phone.trim()) {
              errors[`contact_${index}_phone`] = 'Phone is required';
            } else if (!/^\d{10}$/.test(contact.phone.replace(/\D/g, ''))) {
              errors[`contact_${index}_phone`] = 'Phone must be 10 digits';
            }
          });
        }
        break;
        
      case 2: // Tender Details
        if (isTenderMandatory) {
          if (!leadFormData.tender.tender_subtype_id) {
            errors.tender_subtype_id = 'Tender subtype is required';
          }
          if (!leadFormData.tender.submission_type_id) {
            errors.submission_type_id = 'Submission type is required';
          }
        }
        break;
        
      case 3: // Other Details
        if (!leadFormData.expected_revenue || leadFormData.expected_revenue <= 0) {
          errors.expected_revenue = 'Expected revenue must be positive';
        }
        if (!leadFormData.revenue_currency_id) {
          errors.revenue_currency_id = 'Currency is required';
        }
        if (!leadFormData.convert_to_opportunity_date) {
          errors.convert_to_opportunity_date = 'Convert to opportunity date is required';
        }
        if (!leadFormData.assigned_to_user_id) {
          errors.assigned_to_user_id = 'Assigned user is required';
        }
        if (leadFormData.decision_maker_percentage && 
            (leadFormData.decision_maker_percentage < 1 || leadFormData.decision_maker_percentage > 100)) {
          errors.decision_maker_percentage = 'Decision maker percentage must be between 1 and 100';
        }
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setLeadFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle nested form input changes
  const handleNestedInputChange = (section, index, field, value) => {
    setLeadFormData(prev => ({
      ...prev,
      [section]: prev[section].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Handle tender form input changes
  const handleTenderInputChange = (field, value) => {
    setLeadFormData(prev => ({
      ...prev,
      tender: {
        ...prev.tender,
        [field]: value
      }
    }));
  };

  // Add new contact
  const addContact = () => {
    setLeadFormData(prev => ({
      ...prev,
      contacts: [...prev.contacts, {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        mobile: '',
        designation_id: '',
        department: '',
        is_primary: false,
        is_decision_maker: false,
        decision_maker_percentage: 0
      }]
    }));
  };

  // Remove contact
  const removeContact = (index) => {
    if (leadFormData.contacts.length > 1) {
      setLeadFormData(prev => ({
        ...prev,
        contacts: prev.contacts.filter((_, i) => i !== index)
      }));
    }
  };

  // Add new competitor
  const addCompetitor = () => {
    setLeadFormData(prev => ({
      ...prev,
      competitors: [...prev.competitors, {
        competitor_id: '',
        competitor_strength: 'Medium',
        competitive_notes: ''
      }]
    }));
  };

  // Remove competitor
  const removeCompetitor = (index) => {
    setLeadFormData(prev => ({
      ...prev,
      competitors: prev.competitors.filter((_, i) => i !== index)
    }));
  };

  // Add new document
  const addDocument = () => {
    setLeadFormData(prev => ({
      ...prev,
      documents: [...prev.documents, {
        document_type_id: '',
        document_name: '',
        file_path: '',
        document_description: ''
      }]
    }));
  };

  // Remove document
  const removeDocument = (index) => {
    setLeadFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  // Handle step navigation
  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Reset form
  const resetForm = () => {
    setLeadFormData({
      project_title: '',
      lead_subtype_id: '',
      lead_source_id: '',
      company_id: '',
      project_description: '',
      project_start_date: '',
      project_end_date: '',
      contacts: [{
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        mobile: '',
        designation_id: '',
        department: '',
        is_primary: true,
        is_decision_maker: false,
        decision_maker_percentage: 0
      }],
      tender: {
        tender_subtype_id: '',
        submission_type_id: '',
        tender_number: '',
        tender_value: '',
        tender_currency_id: '',
        tender_description: '',
        dates: [{
          date_type: 'submission',
          date_value: '',
          description: ''
        }],
        clauses: [{
          clause_id: '',
          clause_value: '',
          clause_notes: ''
        }]
      },
      expected_revenue: '',
      revenue_currency_id: '',
      convert_to_opportunity_date: '',
      assigned_to_user_id: '',
      decision_maker_percentage: '',
      competitors: [{
        competitor_id: '',
        competitor_strength: 'Medium',
        competitive_notes: ''
      }],
      documents: [{
        document_type_id: '',
        document_name: '',
        file_path: '',
        document_description: ''
      }],
      notes: ''
    });
    setCurrentStep(0);
    setValidationErrors({});
  };

  // Handle create lead
  const handleCreateLead = async () => {
    // Validate all steps
    let allValid = true;
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i)) {
        allValid = false;
        if (i < currentStep) {
          setCurrentStep(i); // Go to first invalid step
        }
        break;
      }
    }

    if (!allValid) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);

      // Prepare lead data for API
      const leadData = {
        project_title: leadFormData.project_title,
        lead_subtype_id: leadFormData.lead_subtype_id,
        lead_source_id: leadFormData.lead_source_id,
        company_id: leadFormData.company_id,
        project_description: leadFormData.project_description,
        project_start_date: leadFormData.project_start_date || null,
        project_end_date: leadFormData.project_end_date || null,
        expected_revenue: parseFloat(leadFormData.expected_revenue),
        revenue_currency_id: leadFormData.revenue_currency_id,
        convert_to_opportunity_date: leadFormData.convert_to_opportunity_date,
        assigned_to_user_id: leadFormData.assigned_to_user_id,
        decision_maker_percentage: leadFormData.decision_maker_percentage ? parseInt(leadFormData.decision_maker_percentage) : null,
        notes: leadFormData.notes
      };

      const response = await axios.post(`${API_BASE_URL}/api/leads`, leadData, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Lead created successfully');
        setShowAddDialog(false);
        resetForm();
        fetchLeads();
        
        // TODO: Create nested entities (contacts, tender details, competitors, documents)
        // This would require additional API calls to create related entities
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      toast.error(error.response?.data?.detail || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  // Handle approve/reject lead
  const handleApproveLead = async (leadId, status, comments = '') => {
    try {
      setLoading(true);
      const response = await axios.put(`${API_BASE_URL}/api/leads/${leadId}/approve`, {
        approval_status: status,
        approval_comments: comments
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success(`Lead ${status} successfully`);
        fetchLeads();
      }
    } catch (error) {
      console.error(`Error ${status} lead:`, error);
      toast.error(error.response?.data?.detail || `Failed to ${status} lead`);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete lead
  const handleDeleteLead = async (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        setLoading(true);
        const response = await axios.delete(`${API_BASE_URL}/api/leads/${leadId}`, {
          headers: getAuthHeaders()
        });

        if (response.data.success) {
          toast.success('Lead deleted successfully');
          fetchLeads();
        }
      } catch (error) {
        console.error('Error deleting lead:', error);
        toast.error(error.response?.data?.detail || 'Failed to delete lead');
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter leads based on search term
  const filteredLeads = leads.filter(lead =>
    lead.project_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.lead_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // DataTable columns configuration
  const columns = [
    {
      key: 'lead_id',
      label: 'Lead ID',
      sortable: true,
      render: (value) => (
        <Badge variant="outline" className="font-mono">
          {value}
        </Badge>
      )
    },
    {
      key: 'project_title',
      label: 'Project Title',
      sortable: true,
      render: (value) => (
        <div className="font-medium">{value}</div>
      )
    },
    {
      key: 'company_name',
      label: 'Company',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          {value}
        </div>
      )
    },
    {
      key: 'lead_subtype_name',
      label: 'Type',
      sortable: true,
      render: (value) => (
        <Badge variant={value === 'Tender' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'expected_revenue',
      label: 'Expected Revenue',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {row.currency_symbol || '₹'} {parseFloat(value).toLocaleString()}
          </span>
        </div>
      )
    },
    {
      key: 'approval_status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Badge 
          variant={
            value === 'approved' ? 'default' : 
            value === 'rejected' ? 'destructive' : 
            'secondary'
          }
          className="flex items-center gap-1"
        >
          {value === 'approved' && <CheckCircle className="h-3 w-3" />}
          {value === 'rejected' && <XCircle className="h-3 w-3" />}
          {value === 'pending' && <Clock className="h-3 w-3" />}
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      )
    },
    {
      key: 'assigned_user_name',
      label: 'Assigned To',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          {value}
        </div>
      )
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value) => (
        <div className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString()}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedLead(row);
              setShowViewDialog(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          <ProtectedComponent 
            requiredPermission="edit" 
            requiredResource="/leads"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedLead(row);
                setShowEditDialog(true);
              }}
              disabled={row.approval_status === 'approved'}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </ProtectedComponent>

          <ProtectedComponent 
            requiredPermission="delete" 
            requiredResource="/leads"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteLead(row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ProtectedComponent>

          {row.approval_status === 'pending' && (
            <ProtectedComponent 
              requiredPermission="edit" 
              requiredResource="/leads"
            >
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleApproveLead(row.id, 'approved')}
                  className="text-green-600 hover:text-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleApproveLead(row.id, 'rejected')}
                  className="text-red-600 hover:text-red-700"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </ProtectedComponent>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Lead Management</h2>
          <p className="text-muted-foreground">
            Manage and track sales leads with comprehensive workflow
          </p>
        </div>
        <ProtectedComponent 
          requiredPermission="create" 
          requiredResource="/leads"
        >
          <Button
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </ProtectedComponent>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              All leads in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Leads</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.pendingLeads}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Leads</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.approvedLeads}</div>
            <p className="text-xs text-muted-foreground">
              Ready to convert
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.thisMonth}</div>
            <p className="text-xs text-muted-foreground">
              New leads added
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-[300px]"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLeads}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <DataTable
            data={filteredLeads}
            columns={columns}
            loading={loading}
            searchable={false} // We handle search externally
          />
        </CardContent>
      </Card>

      {/* Add Lead Dialog with Stepper */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>
              Fill in the lead information using the step-by-step form below.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Navigation */}
          <div className="flex items-center justify-between mb-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= index
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground text-muted-foreground'
                  }`}
                >
                  {step.icon}
                </div>
                <div
                  className={`ml-2 ${
                    currentStep >= index ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs">{step.description}</div>
                </div>
                {index < steps.length - 1 && (
                  <ChevronRight className="mx-4 h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="space-y-6">
            {/* Step 0: General Lead Details */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">General Lead Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_title">
                      Project Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="project_title"
                      value={leadFormData.project_title}
                      onChange={(e) => handleInputChange('project_title', e.target.value)}
                      placeholder="Enter project title"
                      className={validationErrors.project_title ? 'border-red-500' : ''}
                    />
                    {validationErrors.project_title && (
                      <p className="text-sm text-red-500">{validationErrors.project_title}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lead_subtype_id">
                      Lead Subtype <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={leadFormData.lead_subtype_id}
                      onValueChange={(value) => handleInputChange('lead_subtype_id', value)}
                    >
                      <SelectTrigger className={validationErrors.lead_subtype_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select lead subtype" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.leadSubtypes.map((subtype) => (
                          <SelectItem key={subtype.id} value={subtype.id}>
                            {subtype.lead_subtype_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.lead_subtype_id && (
                      <p className="text-sm text-red-500">{validationErrors.lead_subtype_id}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lead_source_id">
                      Lead Source <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={leadFormData.lead_source_id}
                      onValueChange={(value) => handleInputChange('lead_source_id', value)}
                    >
                      <SelectTrigger className={validationErrors.lead_source_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select lead source" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.leadSources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.lead_source_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.lead_source_id && (
                      <p className="text-sm text-red-500">{validationErrors.lead_source_id}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_id">
                      Company <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={leadFormData.company_id}
                      onValueChange={(value) => handleInputChange('company_id', value)}
                    >
                      <SelectTrigger className={validationErrors.company_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.companies.map((company) => (
                          <SelectItem key={company.company_id} value={company.company_id}>
                            {company.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.company_id && (
                      <p className="text-sm text-red-500">{validationErrors.company_id}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project_start_date">Project Start Date</Label>
                    <Input
                      id="project_start_date"
                      type="date"
                      value={leadFormData.project_start_date}
                      onChange={(e) => handleInputChange('project_start_date', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project_end_date">Project End Date</Label>
                    <Input
                      id="project_end_date"
                      type="date"
                      value={leadFormData.project_end_date}
                      onChange={(e) => handleInputChange('project_end_date', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project_description">Project Description</Label>
                  <Textarea
                    id="project_description"
                    value={leadFormData.project_description}
                    onChange={(e) => handleInputChange('project_description', e.target.value)}
                    placeholder="Describe the project requirements..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Step 1: Contact Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Contact Details</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addContact}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </div>

                {validationErrors.contacts && (
                  <p className="text-sm text-red-500">{validationErrors.contacts}</p>
                )}

                <div className="space-y-6">
                  {leadFormData.contacts.map((contact, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            Contact {index + 1}
                            {contact.is_primary && (
                              <Badge variant="default" className="ml-2">Primary</Badge>
                            )}
                          </CardTitle>
                          {leadFormData.contacts.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeContact(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>
                              First Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              value={contact.first_name}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'first_name', e.target.value)}
                              placeholder="Enter first name"
                              className={validationErrors[`contact_${index}_first_name`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`contact_${index}_first_name`] && (
                              <p className="text-sm text-red-500">{validationErrors[`contact_${index}_first_name`]}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>
                              Last Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              value={contact.last_name}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'last_name', e.target.value)}
                              placeholder="Enter last name"
                              className={validationErrors[`contact_${index}_last_name`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`contact_${index}_last_name`] && (
                              <p className="text-sm text-red-500">{validationErrors[`contact_${index}_last_name`]}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>
                              Email <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="email"
                              value={contact.email}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'email', e.target.value)}
                              placeholder="Enter email address"
                              className={validationErrors[`contact_${index}_email`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`contact_${index}_email`] && (
                              <p className="text-sm text-red-500">{validationErrors[`contact_${index}_email`]}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>
                              Phone <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              value={contact.phone}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'phone', e.target.value)}
                              placeholder="Enter phone number"
                              className={validationErrors[`contact_${index}_phone`] ? 'border-red-500' : ''}
                            />
                            {validationErrors[`contact_${index}_phone`] && (
                              <p className="text-sm text-red-500">{validationErrors[`contact_${index}_phone`]}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Mobile</Label>
                            <Input
                              value={contact.mobile}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'mobile', e.target.value)}
                              placeholder="Enter mobile number"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Designation</Label>
                            <Select
                              value={contact.designation_id}
                              onValueChange={(value) => handleNestedInputChange('contacts', index, 'designation_id', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select designation" />
                              </SelectTrigger>
                              <SelectContent>
                                {masterData.designations.map((designation) => (
                                  <SelectItem key={designation.id} value={designation.id}>
                                    {designation.designation_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Department</Label>
                            <Input
                              value={contact.department}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'department', e.target.value)}
                              placeholder="Enter department"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Decision Maker %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={contact.decision_maker_percentage}
                              onChange={(e) => handleNestedInputChange('contacts', index, 'decision_maker_percentage', parseInt(e.target.value) || 0)}
                              placeholder="0-100"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`primary-${index}`}
                              checked={contact.is_primary}
                              onCheckedChange={(checked) => {
                                // Ensure only one primary contact
                                const updatedContacts = leadFormData.contacts.map((c, i) => ({
                                  ...c,
                                  is_primary: i === index ? checked : false
                                }));
                                setLeadFormData(prev => ({
                                  ...prev,
                                  contacts: updatedContacts
                                }));
                              }}
                            />
                            <Label htmlFor={`primary-${index}`}>Primary Contact</Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`decision-maker-${index}`}
                              checked={contact.is_decision_maker}
                              onCheckedChange={(checked) => 
                                handleNestedInputChange('contacts', index, 'is_decision_maker', checked)
                              }
                            />
                            <Label htmlFor={`decision-maker-${index}`}>Decision Maker</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Tender Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Tender Details
                  {isTenderMandatory && (
                    <span className="text-sm text-red-500 ml-2">(Required for Tender/Pre-tender)</span>
                  )}
                </h3>

                {isTenderMandatory ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>
                          Tender Subtype <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={leadFormData.tender.tender_subtype_id}
                          onValueChange={(value) => handleTenderInputChange('tender_subtype_id', value)}
                        >
                          <SelectTrigger className={validationErrors.tender_subtype_id ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select tender subtype" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterData.tenderSubtypes.map((subtype) => (
                              <SelectItem key={subtype.id} value={subtype.id}>
                                {subtype.tender_subtype_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.tender_subtype_id && (
                          <p className="text-sm text-red-500">{validationErrors.tender_subtype_id}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Submission Type <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={leadFormData.tender.submission_type_id}
                          onValueChange={(value) => handleTenderInputChange('submission_type_id', value)}
                        >
                          <SelectTrigger className={validationErrors.submission_type_id ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select submission type" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterData.submissionTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.submission_type_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.submission_type_id && (
                          <p className="text-sm text-red-500">{validationErrors.submission_type_id}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Tender Number</Label>
                        <Input
                          value={leadFormData.tender.tender_number}
                          onChange={(e) => handleTenderInputChange('tender_number', e.target.value)}
                          placeholder="Enter tender number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tender Value</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={leadFormData.tender.tender_value}
                          onChange={(e) => handleTenderInputChange('tender_value', e.target.value)}
                          placeholder="Enter tender value"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tender Currency</Label>
                        <Select
                          value={leadFormData.tender.tender_currency_id}
                          onValueChange={(value) => handleTenderInputChange('tender_currency_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterData.currencies.map((currency) => (
                              <SelectItem key={currency.currency_id} value={currency.currency_id}>
                                {currency.currency_code} - {currency.currency_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Tender Description</Label>
                      <Textarea
                        value={leadFormData.tender.tender_description}
                        onChange={(e) => handleTenderInputChange('tender_description', e.target.value)}
                        placeholder="Describe the tender requirements..."
                        rows={4}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Tender details are not required for this lead type.</p>
                    <p className="text-sm">You can skip this step or fill in tender information if applicable.</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Other Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Other Details</h3>

                {/* Revenue Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Revenue Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>
                          Expected Revenue <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={leadFormData.expected_revenue}
                          onChange={(e) => handleInputChange('expected_revenue', e.target.value)}
                          placeholder="Enter expected revenue"
                          className={validationErrors.expected_revenue ? 'border-red-500' : ''}
                        />
                        {validationErrors.expected_revenue && (
                          <p className="text-sm text-red-500">{validationErrors.expected_revenue}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Currency <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={leadFormData.revenue_currency_id}
                          onValueChange={(value) => handleInputChange('revenue_currency_id', value)}
                        >
                          <SelectTrigger className={validationErrors.revenue_currency_id ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterData.currencies.map((currency) => (
                              <SelectItem key={currency.currency_id} value={currency.currency_id}>
                                {currency.currency_code} - {currency.currency_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.revenue_currency_id && (
                          <p className="text-sm text-red-500">{validationErrors.revenue_currency_id}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Convert to Opportunity Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          type="date"
                          value={leadFormData.convert_to_opportunity_date}
                          onChange={(e) => handleInputChange('convert_to_opportunity_date', e.target.value)}
                          className={validationErrors.convert_to_opportunity_date ? 'border-red-500' : ''}
                        />
                        {validationErrors.convert_to_opportunity_date && (
                          <p className="text-sm text-red-500">{validationErrors.convert_to_opportunity_date}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Assignment Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Assignment Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>
                          Assigned To <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={leadFormData.assigned_to_user_id}
                          onValueChange={(value) => handleInputChange('assigned_to_user_id', value)}
                        >
                          <SelectTrigger className={validationErrors.assigned_to_user_id ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {masterData.users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.assigned_to_user_id && (
                          <p className="text-sm text-red-500">{validationErrors.assigned_to_user_id}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Decision Maker Percentage</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={leadFormData.decision_maker_percentage}
                          onChange={(e) => handleInputChange('decision_maker_percentage', e.target.value)}
                          placeholder="1-100"
                          className={validationErrors.decision_maker_percentage ? 'border-red-500' : ''}
                        />
                        {validationErrors.decision_maker_percentage && (
                          <p className="text-sm text-red-500">{validationErrors.decision_maker_percentage}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Competitors */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Competitors</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCompetitor}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Competitor
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {leadFormData.competitors.map((competitor, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Competitor</Label>
                              <Select
                                value={competitor.competitor_id}
                                onValueChange={(value) => handleNestedInputChange('competitors', index, 'competitor_id', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select competitor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {masterData.competitors.map((comp) => (
                                    <SelectItem key={comp.id} value={comp.id}>
                                      {comp.competitor_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Strength</Label>
                              <Select
                                value={competitor.competitor_strength}
                                onValueChange={(value) => handleNestedInputChange('competitors', index, 'competitor_strength', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="High">High</SelectItem>
                                  <SelectItem value="Medium">Medium</SelectItem>
                                  <SelectItem value="Low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Notes</Label>
                              <Input
                                value={competitor.competitive_notes}
                                onChange={(e) => handleNestedInputChange('competitors', index, 'competitive_notes', e.target.value)}
                                placeholder="Competitor notes"
                              />
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCompetitor(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Documents</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addDocument}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Document
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {leadFormData.documents.map((document, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Document Name</Label>
                              <Input
                                value={document.document_name}
                                onChange={(e) => handleNestedInputChange('documents', index, 'document_name', e.target.value)}
                                placeholder="Enter document name"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>File Path</Label>
                              <Input
                                value={document.file_path}
                                onChange={(e) => handleNestedInputChange('documents', index, 'file_path', e.target.value)}
                                placeholder="Enter file path or URL"
                              />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label>Description</Label>
                              <Textarea
                                value={document.document_description}
                                onChange={(e) => handleNestedInputChange('documents', index, 'document_description', e.target.value)}
                                placeholder="Document description"
                                rows={2}
                              />
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={leadFormData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Enter any additional notes or comments..."
                    rows={4}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {currentStep < steps.length - 1 ? (
                <Button onClick={goToNextStep}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateLead} disabled={loading}>
                    {loading ? 'Creating...' : 'Create Lead'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Lead Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              View comprehensive lead information
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-6">
              {/* Lead Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {selectedLead.lead_id}
                        </Badge>
                        {selectedLead.project_title}
                      </CardTitle>
                      <CardDescription>
                        {selectedLead.company_name} • {selectedLead.lead_subtype_name}
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={
                        selectedLead.approval_status === 'approved' ? 'default' : 
                        selectedLead.approval_status === 'rejected' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {selectedLead.approval_status.charAt(0).toUpperCase() + selectedLead.approval_status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Expected Revenue</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {selectedLead.currency_symbol || '₹'} {parseFloat(selectedLead.expected_revenue).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-muted-foreground">Lead Source</Label>
                      <div className="mt-1">
                        <Badge variant="outline">{selectedLead.lead_source_name}</Badge>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-muted-foreground">Assigned To</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.assigned_user_name}</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm text-muted-foreground">Created</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{new Date(selectedLead.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    {selectedLead.convert_to_opportunity_date && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Convert by</Label>
                        <div className="mt-1">
                          <span>{new Date(selectedLead.convert_to_opportunity_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                    
                    {selectedLead.decision_maker_percentage && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Decision Maker %</Label>
                        <div className="mt-1">
                          <Badge variant="secondary">{selectedLead.decision_maker_percentage}%</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedLead.project_description && (
                    <div className="mt-4">
                      <Label className="text-sm text-muted-foreground">Project Description</Label>
                      <p className="mt-1 text-sm">{selectedLead.project_description}</p>
                    </div>
                  )}
                  
                  {selectedLead.notes && (
                    <div className="mt-4">
                      <Label className="text-sm text-muted-foreground">Notes</Label>
                      <p className="mt-1 text-sm">{selectedLead.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* TODO: Add tabs for related data (contacts, tender details, competitors, documents) */}
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Related data (contacts, tender details, competitors, documents) will be displayed here.</p>
                <p className="text-xs">This requires additional API endpoints for nested entities.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadManagement;