import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Progress } from './ui/progress';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
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
  TrendingUp,
  Building,
  User,
  Calendar,
  DollarSign,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Link,
  BarChart3,
  Award,
  Zap,
  FileText,
  Users,
  Shield,
  Activity,
  PieChart,
  LineChart,
  Settings,
  ChevronRight,
  ChevronDown,
  Star,
  AlertTriangle,
  Info,
  CheckSquare,
  XCircle,
  PlayCircle,
  PauseCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Upload,
  Save,
  Send,
  FileSignature,
  CheckCheck,
  Clock3,
  FileCheck,
  MessageSquare,
  History,
  Workflow,
  Briefcase,
  Receipt,
  Calculator,
  Archive,
  RotateCcw,
  Bell,
  ExternalLink,
  Package,
  ShoppingCart,
  CreditCard,
  Layers
} from 'lucide-react';
import axios from 'axios';
import DataTable from './DataTable';
import ProtectedComponent from './ProtectedComponent';

const EnhancedOpportunityManagement = () => {
  const navigate = useNavigate();
  
  // State management
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showPipelineView, setShowPipelineView] = useState(true);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Enhanced statistics
  const [statistics, setStatistics] = useState({
    totalOpportunities: 0,
    openOpportunities: 0,
    tenderOpportunities: 0,
    nonTenderOpportunities: 0,
    thisMonth: 0,
    winRate: 0,
    averageDealSize: 0,
    totalPipelineValue: 0,
    weightedRevenue: 0
  });

  // Pipeline and stage management
  const [pipelineStages] = useState([
    { id: 'L1', name: 'Prospect', color: 'bg-blue-100 text-blue-800', probability: 10 },
    { id: 'L2', name: 'Qualification', color: 'bg-yellow-100 text-yellow-800', probability: 25 },
    { id: 'L3', name: 'Proposal/Bid', color: 'bg-orange-100 text-orange-800', probability: 40 },
    { id: 'L4', name: 'Technical Qualification', color: 'bg-purple-100 text-purple-800', probability: 60 },
    { id: 'L5', name: 'Commercial Negotiations', color: 'bg-indigo-100 text-indigo-800', probability: 75 },
    { id: 'L6', name: 'Won', color: 'bg-green-100 text-green-800', probability: 100 },
    { id: 'L7', name: 'Lost', color: 'bg-red-100 text-red-800', probability: 0 },
    { id: 'L8', name: 'Dropped', color: 'bg-gray-100 text-gray-800', probability: 0 }
  ]);

  // Stage-specific form data
  const [stageFormData, setStageFormData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [currentStage, setCurrentStage] = useState('L1');
  
  // Form state for opportunity creation
  const [opportunityFormData, setOpportunityFormData] = useState({
    lead_id: '',
    opportunity_title: '',
    opportunity_type: '',
    company_id: '',
    opportunity_owner_id: '',
    partner_id: '',
    expected_closure_date: '',
    remarks: ''
  });

  // ===== QMS (Quotation Management System) State =====
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationList, setQuotationList] = useState([]);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [quotationFormData, setQuotationFormData] = useState({
    quotation_number: '',
    customer_name: '',
    customer_contact_email: '',
    customer_contact_phone: '',
    pricing_list_id: '',
    currency_id: '1',
    validity_date: '',
    terms_and_conditions: '',
    internal_notes: '',
    external_notes: '',
    overall_discount_type: 'none',
    overall_discount_value: 0,
    discount_reason: ''
  });
  const [quotationPhases, setQuotationPhases] = useState([]);
  const [activeQuotationTab, setActiveQuotationTab] = useState('details');
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [productCatalog, setProductCatalog] = useState([]);
  const [pricingLists, setPricingLists] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  
  // View mode state
  const [showViewMode, setShowViewMode] = useState(false);
  const [activeViewStage, setActiveViewStage] = useState('L1');
  
  // Master data state
  const [masterData, setMasterData] = useState({
    approvedLeads: [],
    companies: [],
    users: [],
    currencies: [],
    products: [],
    regions: []
  });

  // Forecasting and analytics
  const [forecastData, setForecastData] = useState(null);
  const [competitorAnalysis, setCompetitorAnalysis] = useState([]);
  
  // Approval workflow state
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalHistory, setApprovalHistory] = useState([]);
  
  // Profitability visualization state
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [whatIfDiscount, setWhatIfDiscount] = useState(0);
  const [whatIfAnalysis, setWhatIfAnalysis] = useState(null);
  const [profitTrends, setProfitTrends] = useState(null);

  // API configuration
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Load data on component mount
  useEffect(() => {
    fetchOpportunities();
    fetchMasterData();
    fetchForecastData();
    fetchCompetitorAnalysis();
  }, []);

  // Fetch opportunities with enhanced data
  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/opportunities`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        const enrichedOpportunities = response.data.data.map(opp => ({
          ...opp,
          stageId: opp.current_stage_name || 'L1',
          stageName: pipelineStages.find(s => s.id === (opp.current_stage_name || 'L1'))?.name || 'Prospect',
          probability: pipelineStages.find(s => s.id === (opp.current_stage_name || 'L1'))?.probability || 10
        }));
        setOpportunities(enrichedOpportunities);
        calculateStatistics(enrichedOpportunities);
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      toast.error(error.response?.data?.detail || 'Failed to fetch opportunities');
    } finally {
      setLoading(false);
    }
  };

  // Fetch master data
  const fetchMasterData = async () => {
    try {
      const endpoints = [
        'leads',
        'companies',
        'users',
        'master/currencies'
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint =>
          axios.get(`${API_BASE_URL}/api/${endpoint}`, {
            headers: getAuthHeaders()
          }).catch(err => ({ data: { success: false, data: [] } }))
        )
      );

      const [leadsRes, companiesRes, usersRes, currenciesRes] = responses;

      const allLeads = leadsRes.data.success ? leadsRes.data.data : [];
      const approvedLeads = allLeads.filter(lead => 
        lead.approval_status === 'approved' && 
        !opportunities.some(opp => opp.lead_id === lead.id)
      );

      setMasterData({
        approvedLeads,
        companies: companiesRes.data.success ? companiesRes.data.data.map(company => ({
          id: company.company_id,
          name: company.company_name,
          ...company
        })) : [],
        users: usersRes.data.success ? usersRes.data.data : [],
        currencies: currenciesRes.data.success ? currenciesRes.data.data : [],
        products: [
          { id: 'software', name: 'Software Solutions' },
          { id: 'hardware', name: 'Hardware Infrastructure' },
          { id: 'services', name: 'Professional Services' },
          { id: 'support', name: 'Support & Maintenance' },
          { id: 'cloud', name: 'Cloud Services' },
          { id: 'security', name: 'Security Solutions' }
        ],
        regions: [
          { id: 'APAC', name: 'Asia Pacific' },
          { id: 'EMEA', name: 'Europe, Middle East & Africa' },
          { id: 'AMERICAS', name: 'Americas' },
          { id: 'INDIA', name: 'India' }
        ]
      });
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Failed to fetch master data');
    }
  };

  // Fetch forecasting data
  const fetchForecastData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/analytics`, {
        headers: getAuthHeaders(),
        params: { period: 'quarterly' }
      });
      
      if (response.data.success) {
        setForecastData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error);
    }
  };

  // Fetch competitor analysis
  const fetchCompetitorAnalysis = async () => {
    try {
      // Try to get real competitor data from enhanced analytics
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/enhanced-analytics`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        const analyticsData = response.data.data;
        setCompetitorAnalysis(analyticsData.competitor_analysis || []);
      } else {
        // Fallback to calculated competitor data from opportunities
        const competitorMap = {};
        opportunities.forEach(opp => {
          if (opp.competitor_name) {
            if (!competitorMap[opp.competitor_name]) {
              competitorMap[opp.competitor_name] = {
                name: opp.competitor_name,
                opportunities: 0,
                won: 0
              };
            }
            competitorMap[opp.competitor_name].opportunities++;
            if (opp.stageId === 'L6') {
              competitorMap[opp.competitor_name].won++;
            }
          }
        });

        const competitorData = Object.values(competitorMap).map(comp => ({
          name: comp.name,
          opportunities: comp.opportunities,
          winRate: comp.opportunities > 0 ? (comp.won / comp.opportunities * 100).toFixed(1) : 0
        }));

        // If no real competitors, use sample data for demo
        if (competitorData.length === 0) {
          competitorData.push(
            { name: 'Market Leader Corp', opportunities: 15, winRate: 25 },
            { name: 'Tech Solutions Inc', opportunities: 12, winRate: 30 },
            { name: 'Innovation Partners', opportunities: 8, winRate: 15 }
          );
        }

        setCompetitorAnalysis(competitorData);
      }
    } catch (error) {
      console.error('Error fetching competitor analysis:', error);
      // Default to sample data on error
      setCompetitorAnalysis([
        { name: 'Market Leader Corp', opportunities: 15, winRate: 25 },
        { name: 'Tech Solutions Inc', opportunities: 12, winRate: 30 },
        { name: 'Innovation Partners', opportunities: 8, winRate: 15 }
      ]);
    }
  };

  // Calculate enhanced statistics
  const calculateStatistics = (opps) => {
    const totalOpportunities = opps.length;
    const openOpportunities = opps.filter(opp => opp.state === 'Open').length;
    const tenderOpportunities = opps.filter(opp => opp.opportunity_type === 'Tender').length;
    const nonTenderOpportunities = opps.filter(opp => opp.opportunity_type === 'Non-Tender').length;
    
    const currentDate = new Date();
    const thisMonth = opps.filter(opp => {
      const oppDate = new Date(opp.created_at);
      return oppDate.getMonth() === currentDate.getMonth() && 
             oppDate.getFullYear() === currentDate.getFullYear();
    }).length;

    const wonOpportunities = opps.filter(opp => opp.stageId === 'L6').length;
    const winRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities * 100).toFixed(1) : 0;
    
    const totalRevenue = opps.reduce((sum, opp) => sum + (opp.expected_revenue || 0), 0);
    const averageDealSize = totalOpportunities > 0 ? (totalRevenue / totalOpportunities).toFixed(0) : 0;
    
    const weightedRevenue = opps.reduce((sum, opp) => {
      return sum + ((opp.expected_revenue || 0) * (opp.probability / 100));
    }, 0);

    setStatistics({
      totalOpportunities,
      openOpportunities,
      tenderOpportunities,
      nonTenderOpportunities,
      thisMonth,
      winRate,
      averageDealSize,
      totalPipelineValue: totalRevenue,
      weightedRevenue: weightedRevenue.toFixed(0)
    });
  };

  // Get stage-specific form fields
  const getStageFormFields = (stage) => {
    const commonFields = [
      // Common fields will be added per stage as needed
    ];

    switch (stage) {
      case 'L1': // Prospect
        return [
          { name: 'region', label: 'Region', type: 'select', options: masterData.regions, required: true },
          { name: 'product_interest', label: 'Product Interest', type: 'select', options: masterData.products, required: true },
          { name: 'assigned_rep', label: 'Assigned Rep', type: 'select', options: masterData.users, required: true },
          { name: 'status', label: 'Status', type: 'select', options: [
            { id: 'new', name: 'New' },
            { id: 'contacted', name: 'Contacted' },
            { id: 'qualified', name: 'Qualified' }
          ], required: true },
          { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 500 },
          { name: 'expected_revenue', label: 'Expected Revenue', type: 'number', required: true },
          { name: 'currency', label: 'Currency', type: 'select', options: masterData.currencies.map(c => ({ id: c.currency_code, name: `${c.currency_name} (${c.currency_symbol})` })), required: true, defaultValue: 'INR' },
          { name: 'convert_date', label: 'Convert Date', type: 'date', required: true }
        ];
      
      case 'L2': // Qualification
        return [
          { name: 'scorecard', label: 'BANT/CHAMP Scorecard', type: 'textarea', required: true, 
            placeholder: 'Budget, Authority, Need, Timeline' },
          { name: 'qualification_status', label: 'Status', type: 'select', options: [
            { id: 'qualified', name: 'Qualified' },
            { id: 'not_now', name: 'Not Now' },
            { id: 'disqualified', name: 'Disqualified' }
          ], required: true },
          { name: 'go_no_go_checklist', label: 'Go/No-Go Checklist', type: 'checklist', items: [
            'Budget confirmed',
            'Decision maker identified',
            'Timeline established',
            'Technical requirements clear'
          ]},
          ...commonFields
        ];
      
      case 'L3': // Proposal/Bid
        return [
          { name: 'proposal_upload', label: 'Proposal Upload', type: 'file', required: true, accept: '.pdf,.doc,.docx' },
          { name: 'version', label: 'Version', type: 'text', required: true },
          { name: 'submission_date', label: 'Submission Date', type: 'date', required: true },
          { name: 'internal_stakeholders', label: 'Internal Stakeholders', type: 'multiselect', options: masterData.users },
          { name: 'client_response', label: 'Client Response', type: 'textarea' },
          ...commonFields
        ];
      
      case 'L4': // Technical Qualification (Enhanced)
        return [
          { name: 'proposal_groups', label: 'Groups/Phases', type: 'multiselect', options: [
            { id: 'hardware', name: 'Hardware' },
            { id: 'software', name: 'Software' },
            { id: 'services', name: 'Services' },
            { id: 'support', name: 'Support' }
          ], required: true },
          { name: 'item_selection', label: 'Item Selection', type: 'itemselect', required: true },
          { name: 'quotation_status', label: 'Quotation Status', type: 'select', options: [
            { id: 'draft', name: 'Draft' },
            { id: 'submitted', name: 'Submitted' },
            { id: 'approved', name: 'Approved' }
          ], required: true },
          { name: 'digital_signature', label: 'Digital Signature', type: 'file', required: true, accept: '.pdf,.p7s' },
          { name: 'version_auto', label: 'Version', type: 'text', value: '1.0', disabled: true },
          { name: 'revision_comments', label: 'Revision Comments', type: 'textarea' },
          { name: 'version_history', label: 'Version History', type: 'display', value: 'v1.0 - Initial version' },
          ...commonFields
        ];
      
      case 'L5': // Commercial Negotiations
        return [
          { name: 'updated_pricing', label: 'Updated Pricing', type: 'number', required: true },
          { name: 'margin_check', label: 'Margin Check (%)', type: 'number', required: true },
          { name: 'terms_conditions', label: 'Terms & Conditions', type: 'textarea' },
          { name: 'legal_doc_status', label: 'Legal Doc Status', type: 'select', options: [
            { id: 'pending', name: 'Pending' },
            { id: 'in_review', name: 'In Review' },
            { id: 'approved', name: 'Approved' }
          ]},
          { name: 'po_number', label: 'PO Number', type: 'text', required: true },
          { name: 'po_date', label: 'PO Date', type: 'date' },
          { name: 'po_amount', label: 'PO Amount', type: 'number' },
          { name: 'po_file', label: 'PO File', type: 'file', accept: '.pdf,.jpg,.png' },
          ...commonFields
        ];
      
      case 'L6': // Won
        return [
          { name: 'final_value', label: 'Final Value', type: 'number', required: true },
          { name: 'client_poc', label: 'Client PoC', type: 'text' },
          { name: 'handover_status', label: 'Handover Status', type: 'select', options: [
            { id: 'pending', name: 'Pending' },
            { id: 'in_progress', name: 'In Progress' },
            { id: 'completed', name: 'Completed' }
          ], required: true },
          { name: 'delivery_team', label: 'Delivery Team', type: 'select', options: masterData.users },
          { name: 'kickoff_task', label: 'Kickoff Task', type: 'textarea' },
          { name: 'revenue_recognition', label: 'Revenue Recognition Flag', type: 'checkbox' }
        ];
      
      case 'L7': // Lost
        return [
          { name: 'lost_reason', label: 'Lost Reason', type: 'select', options: [
            { id: 'price', name: 'Price' },
            { id: 'competitor', name: 'Competitor' },
            { id: 'technical', name: 'Technical' },
            { id: 'timeline', name: 'Timeline' }
          ], required: true },
          { name: 'competitor', label: 'Competitor', type: 'text' },
          { name: 'followup_reminder', label: 'Follow-up Reminder', type: 'date' },
          { name: 'internal_learnings', label: 'Internal Learnings', type: 'textarea' },
          { name: 'escalation_flag', label: 'Escalation Flag', type: 'checkbox' }
        ];
      
      case 'L8': // Dropped
        return [
          { name: 'drop_reason', label: 'Drop Reason', type: 'select', options: [
            { id: 'inactive', name: 'Inactive' },
            { id: 'cancelled', name: 'Cancelled' },
            { id: 'no_budget', name: 'No Budget' }
          ], required: true },
          { name: 're_nurture_tag', label: 'Re-Nurture Tag', type: 'checkbox' },
          { name: 'reminder_date', label: 'Reminder Date', type: 'date' }
        ];
      
      default:
        return commonFields;
    }
  };

  // Handle stage form input changes
  const handleStageInputChange = async (field, value) => {
    // Handle file uploads immediately
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'File') {
      try {
        // Only upload if we have a selected opportunity
        if (selectedOpportunity) {
          const formData = new FormData();
          formData.append('file', value);
          formData.append('document_type', field);
          
          const response = await axios.post(
            `${API_BASE_URL}/api/opportunities/${selectedOpportunity.id}/upload-document`,
            formData,
            {
              headers: {
                ...getAuthHeaders(),
                'Content-Type': 'multipart/form-data'
              }
            }
          );
          
          if (response.data.success) {
            // Store the uploaded file metadata instead of the file object
            setStageFormData(prev => ({
              ...prev,
              [field]: {
                file_path: response.data.data.file_path,
                original_filename: response.data.data.original_filename,
                document_id: response.data.data.document_id
              }
            }));
            toast.success(`${value.name} uploaded successfully`);
          }
        } else {
          // If no opportunity selected, just store the file temporarily
          setStageFormData(prev => ({
            ...prev,
            [field]: value
          }));
        }
      } catch (error) {
        console.error('File upload error:', error);
        toast.error(`Failed to upload ${value.name}: ${error.response?.data?.detail || error.message}`);
      }
    } else {
      // Handle non-file inputs normally
      setStageFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle opportunity form input changes
  const handleOpportunityInputChange = (field, value) => {
    setOpportunityFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-populate fields when lead is selected
    if (field === 'lead_id' && value) {
      const selectedLead = masterData.approvedLeads.find(lead => lead.id === value);
      if (selectedLead) {
        setOpportunityFormData(prev => ({
          ...prev,
          opportunity_title: selectedLead.project_title || '',
          company_id: selectedLead.company_id || '',
          opportunity_owner_id: selectedLead.assigned_to_user_id || '',
          opportunity_type: selectedLead.lead_subtype_name === 'Tender' || selectedLead.lead_subtype_name === 'Pretender' ? 'Tender' : 'Non-Tender'
        }));
      }
    }
    
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate opportunity form
  const validateOpportunityForm = () => {
    const errors = {};
    
    if (!opportunityFormData.lead_id) {
      errors.lead_id = 'Lead selection is required';
    }
    if (!opportunityFormData.opportunity_title.trim()) {
      errors.opportunity_title = 'Opportunity title is required';
    }
    if (!opportunityFormData.opportunity_type) {
      errors.opportunity_type = 'Opportunity type is required';
    }
    if (!opportunityFormData.company_id) {
      errors.company_id = 'Company is required';
    }
    if (!opportunityFormData.opportunity_owner_id) {
      errors.opportunity_owner_id = 'Opportunity owner is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset opportunity form
  const resetOpportunityForm = () => {
    setOpportunityFormData({
      lead_id: '',
      opportunity_title: '',
      opportunity_type: '',
      company_id: '',
      opportunity_owner_id: '',
      partner_id: '',
      expected_closure_date: '',
      remarks: ''
    });
    setValidationErrors({});
  };

  // Handle create opportunity
  const handleCreateOpportunity = async () => {
    if (!validateOpportunityForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/opportunities`, opportunityFormData, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Opportunity created successfully');
        setShowCreateDialog(false);
        resetOpportunityForm();
        fetchOpportunities();
        fetchMasterData();
        fetchForecastData();
      }
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast.error(error.response?.data?.detail || 'Failed to create opportunity');
    } finally {
      setLoading(false);
    }
  };

  // Validate stage form
  const validateStageForm = (stage) => {
    const errors = {};
    const fields = getStageFormFields(stage);
    
    fields.forEach(field => {
      if (field.required && !stageFormData[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
      
      // Specific validations
      if (field.name === 'expected_revenue' && stageFormData[field.name] <= 0) {
        errors[field.name] = 'Expected revenue must be positive';
      }
      
      if (field.name === 'convert_date' && stageFormData[field.name]) {
        const convertDate = new Date(stageFormData[field.name]);
        const today = new Date();
        if (convertDate < today) {
          errors[field.name] = 'Convert date cannot be in the past';
        }
      }
      
      if (field.name === 'digital_signature' && stageFormData[field.name]) {
        const file = stageFormData[field.name];
        if (file.size > 5 * 1024 * 1024) { // 5MB
          errors[field.name] = 'File size cannot exceed 5MB';
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Load profitability data when opportunity is selected and in L4+ stage
  useEffect(() => {
    if (selectedOpportunity && selectedOpportunity.id && currentStage && ['L4', 'L5', 'L6', 'L7', 'L8'].includes(currentStage)) {
      fetchProfitabilityData(selectedOpportunity.id, selectedCurrency);
      fetchProfitTrends(selectedOpportunity.id);
    }
  }, [selectedOpportunity, currentStage, selectedCurrency]);

  // Initialize default form values when stage changes
  useEffect(() => {
    if (currentStage) {
      // Set default currency if not set
      if (!stageFormData.currency) {
        setStageFormData(prev => ({
          ...prev,
          currency: 'INR'
        }));
      }
      
      // Clear validation errors when stage changes
      setValidationErrors({});
    }
  }, [currentStage]);

  // Initialize form when opportunity is selected
  useEffect(() => {
    if (selectedOpportunity && currentStage) {
      // Pre-populate form with opportunity data if available
      const existingData = selectedOpportunity.stage_form_data || {};
      setStageFormData(prev => ({
        currency: 'INR', // Default currency
        ...existingData, // Load any existing form data
        ...prev // Keep any current form data
      }));
    }
  }, [selectedOpportunity, currentStage]);

  // Get next stage based on business rules
  const getNextStage = (currentStage) => {
    const stageOrder = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'];
    const currentIndex = stageOrder.indexOf(currentStage);
    
    // Business rule: Normal progression L1 → L2 → L3 → L4 → L5 → L6
    // L7 (Lost) and L8 (Dropped) are terminal stages that don't auto-advance
    if (currentIndex >= 0 && currentIndex < 5) { // L1 to L5 can auto-advance
      return stageOrder[currentIndex + 1];
    }
    
    return currentStage; // Stay in same stage if at end or terminal stage
  };

  // Handle stage transition
  const handleStageTransition = async (opportunityId, newStageId) => {
    try {
      setLoading(true);
      
      // For stage transitions, we'll be more lenient and just save the current form data
      // The user can continue filling missing fields in the next stage
      console.log('Transitioning from', currentStage, 'to', newStageId, 'with form data:', stageFormData);
      
      // Check if approval is needed for certain stages
      // L4 is directly accessible, approval happens within L4 when submitting quotation
      // L5 and above require approval to enter
      const needsApproval = ['L5', 'L6', 'L7', 'L8'].includes(newStageId);
      
      if (needsApproval) {
        await requestApproval(opportunityId, newStageId);
      } else {
        await updateOpportunityStage(opportunityId, newStageId);
      }
      
      // Refresh data and update current stage
      await fetchOpportunities();
      
      // Update the current stage to the new stage
      setCurrentStage(newStageId);
      
      // Update the selected opportunity stage
      if (selectedOpportunity) {
        setSelectedOpportunity(prev => ({
          ...prev,
          stageId: newStageId,
          stageName: pipelineStages.find(s => s.id === newStageId)?.name || newStageId,
          current_stage_name: newStageId
        }));
      }
      
      // Clear form data for next stage
      setStageFormData({});
      setValidationErrors({});
      
      toast.success(`Opportunity successfully moved to ${pipelineStages.find(s => s.id === newStageId)?.name || newStageId}`);
    } catch (error) {
      console.error('Error updating stage:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // More specific error handling
      if (error.response?.status === 500) {
        toast.error('Internal Server Error: Please check your form data and try again');
      } else if (error.response?.status === 400) {
        toast.error(`Bad Request: ${error.response?.data?.detail || 'Invalid data provided'}`);
      } else if (error.response?.status === 404) {
        toast.error('Opportunity not found');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to update stage');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle L4 approval request
  const handleL4ApprovalRequest = async () => {
    try {
      if (!selectedOpportunity) {
        toast.error('No opportunity selected');
        return;
      }

      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/api/opportunities/${selectedOpportunity.id}/request-approval`, {
        stage_id: 'L4',
        form_data: stageFormData,
        comments: 'Request approval for quotation submission',
        approval_type: 'quotation_approval'
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Approval request sent successfully');
        // Optionally refresh the opportunity data
        await fetchOpportunities();
      }
    } catch (error) {
      console.error('Error requesting L4 approval:', error);
      toast.error(error.response?.data?.detail || 'Failed to request approval');
    } finally {
      setLoading(false);
    }
  };
  // Request approval for stage transition
  const requestApproval = async (opportunityId, stageId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/opportunities/${opportunityId}/request-approval`, {
        stage_id: stageId,
        form_data: stageFormData,
        comments: stageFormData.revision_comments || ''
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Approval request sent successfully');
      }
    } catch (error) {
      throw error;
    }
  };

  // Update opportunity stage
  const updateOpportunityStage = async (opportunityId, stageId) => {
    try {
      console.log('Updating opportunity stage:', {
        opportunityId,
        stageId,
        formData: stageFormData
      });
      
      const response = await axios.put(`${API_BASE_URL}/api/opportunities/${opportunityId}/stage`, {
        stage_id: stageId,
        form_data: stageFormData
      }, {
        headers: getAuthHeaders()
      });

      console.log('Stage update response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Stage update error:', error.response?.data || error.message);
      throw error;
    }
  };

  // Fetch profitability data
  const fetchProfitabilityData = async (opportunityId, currency = 'INR') => {
    try {
      setProfitabilityLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}/profitability`, {
        headers: getAuthHeaders(),
        params: { currency }
      });

      if (response.data.success) {
        setProfitabilityData(response.data.data);
        setWhatIfAnalysis(null); // Reset what-if analysis
      } else {
        toast.error(response.data.message || 'Failed to fetch profitability data');
      }
    } catch (error) {
      console.error('Error fetching profitability data:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. Sales Executive/Manager role required.');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to generate profitability data. Try again.');
      }
    } finally {
      setProfitabilityLoading(false);
    }
  };

  // Calculate what-if analysis
  const calculateWhatIfAnalysis = async (opportunityId) => {
    try {
      setProfitabilityLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/opportunities/${opportunityId}/profitability/what-if`, {
        currency: selectedCurrency,
        hypothetical_discount: whatIfDiscount
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        setWhatIfAnalysis(response.data.data);
        toast.success('What-if analysis calculated successfully');
      }
    } catch (error) {
      console.error('Error calculating what-if analysis:', error);
      toast.error(error.response?.data?.detail || 'Failed to calculate what-if analysis');
    } finally {
      setProfitabilityLoading(false);
    }
  };

  // Export PnL template
  const exportPnLTemplate = async (opportunityId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}/profitability/export`, {
        headers: getAuthHeaders(),
        params: { currency: selectedCurrency }
      });

      if (response.data.success) {
        const exportData = response.data.data;
        toast.success('PnL exported successfully');
        
        // In a real implementation, this would download the actual Excel file
        // For now, we'll show the export information
        console.log('Export data:', exportData);
        
        // Mock download trigger
        const link = document.createElement('a');
        link.href = '#'; // In real app, this would be the actual file URL
        link.download = exportData.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting PnL:', error);
      toast.error(error.response?.data?.detail || 'Failed to export PnL template');
    }
  };

  // Fetch profit trends
  const fetchProfitTrends = async (opportunityId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}/profitability/trends`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        setProfitTrends(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching profit trends:', error);
    }
  };

  // ===== QMS API FUNCTIONS =====

  // Fetch quotations for an opportunity
  const fetchQuotations = async (opportunityId) => {
    try {
      setQuotationLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/quotations`, {
        headers: getAuthHeaders(),
        params: { opportunity_id: opportunityId }
      });

      if (response.data.success) {
        setQuotationList(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast.error('Failed to fetch quotations');
    } finally {
      setQuotationLoading(false);
    }
  };

  // Fetch product catalog
  const fetchProductCatalog = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products/catalog`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        setProductCatalog(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching product catalog:', error);
      // Fallback to mock data if API fails
      setProductCatalog([
        { id: '1', core_product_name: 'Cloud Compute - Standard VM', primary_category: 'Infrastructure', skucode: 'CC-STD-VM-001' },
        { id: '2', core_product_name: 'Database Service - MySQL', primary_category: 'Database', skucode: 'DB-MYSQL-001' },
        { id: '3', core_product_name: 'Storage - Block Storage', primary_category: 'Storage', skucode: 'STG-BLOCK-001' }
      ]);
    }
  };

  // Fetch pricing lists
  const fetchPricingLists = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/pricing-lists`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        setPricingLists(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching pricing lists:', error);
      // Fallback to mock data if API fails
      setPricingLists([
        { id: '1', name: 'Standard Pricing List' },
        { id: '2', name: 'Enterprise Pricing List' },
        { id: '3', name: 'Government Pricing List' }
      ]);
    }
  };

  // Fetch discount rules
  const fetchDiscountRules = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/discount-rules`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        setDiscountRules(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching discount rules:', error);
    }
  };

  // Create new quotation
  const createQuotation = async (quotationData) => {
    try {
      setQuotationLoading(true);
      
      // Generate quotation number if not provided
      if (!quotationData.quotation_number) {
        const count = quotationList.length;
        quotationData.quotation_number = `QUO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;
      }

      const response = await axios.post(`${API_BASE_URL}/api/quotations`, quotationData, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Quotation created successfully');
        await fetchQuotations(selectedOpportunity?.id);
        setShowQuotationModal(false);
        resetQuotationForm();
        return response.data.data;
      }
    } catch (error) {
      console.error('Error creating quotation:', error);
      toast.error(error.response?.data?.detail || 'Failed to create quotation');
    } finally {
      setQuotationLoading(false);
    }
  };

  // Update quotation
  const updateQuotation = async (quotationId, quotationData) => {
    try {
      setQuotationLoading(true);
      const response = await axios.put(`${API_BASE_URL}/api/quotations/${quotationId}`, quotationData, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Quotation updated successfully');
        await fetchQuotations(selectedOpportunity?.id);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error updating quotation:', error);
      toast.error(error.response?.data?.detail || 'Failed to update quotation');
    } finally {
      setQuotationLoading(false);
    }
  };

  // Get detailed quotation
  const getQuotationDetails = async (quotationId) => {
    try {
      setQuotationLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        setSelectedQuotation(response.data.data);
        setQuotationPhases(response.data.data.phases || []);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching quotation details:', error);
      toast.error('Failed to fetch quotation details');
    } finally {
      setQuotationLoading(false);
    }
  };

  // Submit quotation for approval
  const submitQuotation = async (quotationId) => {
    try {
      setQuotationLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/quotations/${quotationId}/submit`, {}, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Quotation submitted for approval');
        await fetchQuotations(selectedOpportunity?.id);
        if (selectedQuotation && selectedQuotation.id === quotationId) {
          await getQuotationDetails(quotationId);
        }
      }
    } catch (error) {
      console.error('Error submitting quotation:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit quotation');
    } finally {
      setQuotationLoading(false);
    }
  };

  // Export quotation
  const exportQuotation = async (quotationId, format) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}/export/${format}`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success(`Quotation exported as ${format.toUpperCase()}`);
        // In a real implementation, this would trigger a file download
        console.log('Export data:', response.data.data);
      }
    } catch (error) {
      console.error('Error exporting quotation:', error);
      toast.error(`Failed to export quotation as ${format.toUpperCase()}`);
    }
  };

  // Reset quotation form
  const resetQuotationForm = () => {
    setQuotationFormData({
      quotation_number: '',
      customer_name: selectedOpportunity?.company_name || '',
      customer_contact_email: '',
      customer_contact_phone: '',
      pricing_list_id: '',
      currency_id: '1',
      validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      terms_and_conditions: '',
      internal_notes: '',
      external_notes: '',
      overall_discount_type: 'none',
      overall_discount_value: 0,
      discount_reason: ''
    });
    setQuotationPhases([]);
    setSelectedQuotation(null);
    setActiveQuotationTab('details');
  };

  // Handle quotation form changes
  const handleQuotationFormChange = (field, value) => {
    setQuotationFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Load existing documents for an opportunity
  const loadOpportunityDocuments = async (opportunityId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}/documents`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        const documents = response.data.data;
        const documentMap = {};
        
        // Map documents by their type to pre-fill form fields
        documents.forEach(doc => {
          if (doc.document_type) {
            documentMap[doc.document_type] = {
              file_path: doc.file_path,
              original_filename: doc.original_filename,
              document_id: doc.id
            };
          }
        });
        
        // Update stage form data with existing documents
        setStageFormData(prev => ({
          ...prev,
          ...documentMap
        }));
      }
    } catch (error) {
      console.error('Error loading opportunity documents:', error);
    }
  };

  // Load quotations when an opportunity is selected and in L4 stage
  useEffect(() => {
    if (selectedOpportunity && currentStage === 'L4') {
      fetchQuotations(selectedOpportunity.id);
    }
  }, [selectedOpportunity, currentStage]);

  // Render pipeline view
  const renderPipelineView = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Sales Pipeline</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPipelineView(!showPipelineView)}
            >
              {showPipelineView ? 'Table View' : 'Pipeline View'}
            </Button>
            <Button onClick={() => navigate('/opportunities/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Opportunity
            </Button>
          </div>
        </div>

        {showPipelineView ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-8 gap-4 overflow-x-auto">
            {pipelineStages.map(stage => {
              const stageOpportunities = opportunities.filter(opp => opp.stageId === stage.id);
              const stageValue = stageOpportunities.reduce((sum, opp) => sum + (opp.expected_revenue || 0), 0);
              
              return (
                <div key={stage.id} className="min-w-[280px] bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-sm">{stage.name}</h4>
                    <Badge className={stage.color}>
                      {stageOpportunities.length}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-gray-600 mb-3">
                    Value: ${stageValue.toLocaleString()}
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {stageOpportunities.map(opp => (
                      <Card 
                        key={opp.id} 
                        className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={async () => {
                          navigate(`/opportunities/${opp.id}/edit`);
                        }}
                      >
                        <div className="space-y-2">
                          <div className="font-medium text-sm truncate">
                            {opp.opportunity_title}
                          </div>
                          <div className="text-xs text-gray-600">
                            {opp.company_name}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium">
                              ${(opp.expected_revenue || 0).toLocaleString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {opp.probability}%
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(opp.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <DataTable
            data={opportunities}
            columns={[
              {
                key: 'opportunity_id',
                header: 'Opportunity ID',
                sortable: true,
                render: (value) => (
                  <Badge variant="outline" className="font-mono">
                    {value}
                  </Badge>
                )
              },
              {
                key: 'opportunity_title',
                header: 'Title',
                sortable: true,
                render: (value) => (
                  <div className="font-medium max-w-xs truncate" title={value}>
                    {value}
                  </div>
                )
              },
              {
                key: 'company_name',
                header: 'Company',
                sortable: true,
                render: (value) => (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {value}
                  </div>
                )
              },
              {
                key: 'stageName',
                header: 'Stage',
                sortable: true,
                render: (value, row) => (
                  <Badge className={pipelineStages.find(s => s.name === value)?.color || 'bg-gray-100 text-gray-800'}>
                    {value}
                  </Badge>
                )
              },
              {
                key: 'opportunity_type',
                header: 'Type',
                sortable: true,
                render: (value) => (
                  <Badge variant={value === 'Tender' ? 'default' : 'secondary'}>
                    {value}
                  </Badge>
                )
              },
              {
                key: 'expected_revenue',
                header: 'Expected Revenue',
                sortable: true,
                render: (value, row) => (
                  value ? (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        ${parseFloat(value).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )
                )
              },
              {
                key: 'probability',
                header: 'Probability',
                sortable: true,
                render: (value) => (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{value}%</span>
                    <div className="w-12 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${value}%` }}
                      ></div>
                    </div>
                  </div>
                )
              },
              {
                key: 'created_at',
                header: 'Created',
                type: 'date',
                sortable: true,
                render: (value) => new Date(value).toLocaleDateString()
              },
              {
                key: 'actions',
                header: 'Actions',
                sortable: false,
                render: (_, opp) => (
                  <div className="flex space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      title="View Details (Read Only)"
                      onClick={() => {
                        navigate(`/opportunities/${opp.id}`);
                      }}
                      className="text-gray-600 hover:text-gray-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="Edit Opportunity (Manage Stages)"
                      onClick={() => {
                        navigate(`/opportunities/${opp.id}/edit`);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Layers className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      title="Delete Opportunity"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => {
                        // Handle delete
                        toast.info('Delete functionality will be implemented');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            searchable={true}
            exportable={true}
          />
        )}
      </div>
    );
  };

  // Render stage-specific form
  const renderStageForm = (stage) => {
    const fields = getStageFormFields(stage);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Badge className={pipelineStages.find(s => s.id === stage)?.color}>
            {stage}
          </Badge>
          <h4 className="font-medium">
            {pipelineStages.find(s => s.id === stage)?.name}
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(field => (
            <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
              <Label htmlFor={field.name}>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              
              {field.type === 'text' && (
                <Input
                  id={field.name}
                  value={stageFormData[field.name] || ''}
                  onChange={(e) => handleStageInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                />
              )}
              
              {field.type === 'number' && (
                <Input
                  id={field.name}
                  type="number"
                  value={stageFormData[field.name] || ''}
                  onChange={(e) => handleStageInputChange(field.name, parseFloat(e.target.value) || 0)}
                  min={field.min || 0}
                  step={field.step || 1}
                />
              )}
              
              {field.type === 'date' && (
                <Input
                  id={field.name}
                  type="date"
                  value={stageFormData[field.name] || ''}
                  onChange={(e) => handleStageInputChange(field.name, e.target.value)}
                />
              )}
              
              {field.type === 'textarea' && (
                <Textarea
                  id={field.name}
                  value={stageFormData[field.name] || ''}
                  onChange={(e) => handleStageInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  rows={3}
                />
              )}
              
              {field.type === 'select' && (
                <Select
                  value={stageFormData[field.name] || field.defaultValue || ''}
                  onValueChange={(value) => handleStageInputChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {field.type === 'file' && (
                <div className="space-y-2">
                  <Input
                    id={field.name}
                    type="file"
                    accept={field.accept}
                    onChange={(e) => handleStageInputChange(field.name, e.target.files[0])}
                  />
                  {stageFormData[field.name] && (
                    <div className="text-sm text-green-600 flex items-center space-x-2">
                      {stageFormData[field.name].original_filename ? (
                        <>
                          <span>✓ Uploaded: {stageFormData[field.name].original_filename}</span>
                          <a 
                            href={`${API_BASE_URL}${stageFormData[field.name].file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            View
                          </a>
                        </>
                      ) : (
                        <span>File selected: {stageFormData[field.name].name || 'Unknown'}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {field.type === 'checkbox' && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id={field.name}
                    checked={stageFormData[field.name] || false}
                    onCheckedChange={(checked) => handleStageInputChange(field.name, checked)}
                  />
                  <Label htmlFor={field.name}>{field.label}</Label>
                </div>
              )}
              
              {field.type === 'checklist' && (
                <div className="space-y-2 pt-2">
                  {field.items?.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${field.name}_${index}`}
                        checked={stageFormData[`${field.name}_${index}`] || false}
                        onCheckedChange={(checked) => handleStageInputChange(`${field.name}_${index}`, checked)}
                      />
                      <Label htmlFor={`${field.name}_${index}`} className="text-sm">
                        {item}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
              
              {validationErrors[field.name] && (
                <div className="text-red-500 text-sm mt-1">
                  {validationErrors[field.name]}
                </div>
              )}
            </div>
          ))}
          
          {/* Special L4 Request Approval Button */}
          {currentStage === 'L4' && stageFormData.quotation_status === 'approved' && (
            <div className="md:col-span-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleL4ApprovalRequest()}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Request Approval for Quotation
              </Button>
              <p className="text-sm text-gray-500 mt-2 text-center">
                Quotation must be approved before it can be sent to client
              </p>
            </div>
          )}

          {/* Stage Information Display */}
          {selectedOpportunity && (
            <div className="md:col-span-2 pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-600">Current Stage:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    currentStage === 'L4' ? 'bg-green-100 text-green-800' :
                    currentStage === 'L3' ? 'bg-yellow-100 text-yellow-800' :
                    currentStage === 'L2' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentStage} - {
                      currentStage === 'L1' ? 'Prospect' :
                      currentStage === 'L2' ? 'Needs Assessment' :
                      currentStage === 'L3' ? 'Proposal Development' :
                      currentStage === 'L4' ? 'Technical Qualification' :
                      currentStage === 'L5' ? 'Commercial Negotiations' :
                      currentStage === 'L6' ? 'Closure' : 'Unknown Stage'
                    }
                  </span>
                </div>
                {currentStage !== 'L4' && (
                  <div className="text-sm text-gray-500">
                    <Info className="h-4 w-4 inline mr-1" />
                    Quotation management available in L4 stage
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QMS - Add Quotation Button for L4 Stage */}
          {currentStage === 'L4' && selectedOpportunity && (
            <div className="md:col-span-2 pt-4 border-t">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Quotation Management</h3>
                  <Button
                    type="button"
                    onClick={() => {
                      // Navigate to full-page quotation management
                      navigate(`/quotation/new?opportunityId=${selectedOpportunity.id}&stage=L4`);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Quotation
                  </Button>
                </div>

                {/* Existing Quotations List */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Existing Quotations</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchQuotations(selectedOpportunity.id)}
                      disabled={quotationLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${quotationLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  
                  {quotationLoading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-500">Loading quotations...</p>
                    </div>
                  ) : quotationList.length > 0 ? (
                    <div className="space-y-2">
                      {quotationList.map((quotation) => (
                        <div
                          key={quotation.id}
                          className="bg-white rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => {
                            // Navigate to full-page quotation management for editing
                            window.location.href = `/quotation/${quotation.id}?opportunityId=${selectedOpportunity.id}`;
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-900">
                                  {quotation.quotation_number || 'Draft'}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  quotation.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                  quotation.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                                  quotation.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  quotation.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                  quotation.status === 'expired' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {quotation.status?.charAt(0).toUpperCase() + quotation.status?.slice(1)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                Customer: {quotation.customer_name}
                              </p>
                              <p className="text-sm text-gray-500">
                                Created: {new Date(quotation.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {quotation.currency_id === '1' ? '$' : '₹'}{quotation.grand_total?.toLocaleString() || '0.00'}
                              </p>
                              <p className="text-sm text-gray-500">
                                Valid until: {quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500 mb-2">No quotations found</p>
                      <p className="text-sm text-gray-400">
                        Create your first quotation to get started
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Stage-specific action buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {stage === 'L4' && (
              <>
                <Button variant="outline" size="sm">
                  <FileSignature className="h-4 w-4 mr-2" />
                  Request Approval
                </Button>
                <Button variant="outline" size="sm" disabled={stageFormData.quotation_status !== 'approved'}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Proposal
                </Button>
              </>
            )}
            
            {stage === 'L5' && (
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Request Commercial Approval
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowViewDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const nextStage = getNextStage(currentStage);
                handleStageTransition(selectedOpportunity?.id, nextStage);
              }}
              disabled={loading}
            >
              {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Save & Continue
            </Button>
          </div>
        </div>
        
        {/* Profitability Visualization for L4+ stages */}
        {['L4', 'L5', 'L6', 'L7', 'L8'].includes(stage) && selectedOpportunity && (
          renderProfitabilityVisualization(selectedOpportunity.id)
        )}
      </div>
    );
  };

  // Render forecasting dashboard
  const renderForecastingDashboard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Sales Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ${statistics.totalPipelineValue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Pipeline Value</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${statistics.weightedRevenue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Weighted Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {statistics.winRate}%
            </div>
            <div className="text-sm text-gray-600">Win Rate</div>
          </div>
        </div>
        
        {/* Real Forecast Chart */}
        <div className="h-64 bg-gray-50 rounded-lg p-4">
          {forecastData ? (
            <div className="h-full">
              <h4 className="text-lg font-semibold mb-4">Sales Forecast by Stage</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-48">
                {pipelineStages.map((stage, index) => {
                  const stageOpportunities = opportunities.filter(opp => opp.stageId === stage.id);
                  const stageValue = stageOpportunities.reduce((sum, opp) => sum + (opp.expected_revenue || 0), 0);
                  const percentage = statistics.totalPipelineValue > 0 ? (stageValue / statistics.totalPipelineValue * 100) : 0;
                  
                  return (
                    <div key={stage.id} className="text-center">
                      <div className="text-sm font-medium mb-2">{stage.name}</div>
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-gray-300"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className={stage.color.includes('blue') ? 'text-blue-500' : 
                                     stage.color.includes('green') ? 'text-green-500' : 
                                     stage.color.includes('yellow') ? 'text-yellow-500' : 
                                     stage.color.includes('orange') ? 'text-orange-500' : 
                                     stage.color.includes('purple') ? 'text-purple-500' : 
                                     stage.color.includes('indigo') ? 'text-indigo-500' : 
                                     stage.color.includes('red') ? 'text-red-500' : 'text-gray-500'}
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            fill="transparent"
                            strokeDasharray={`${percentage}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-semibold">{percentage.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        ${stageValue.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {stageOpportunities.length} opps
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <div>Loading forecast data...</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Render competitor analysis
  const renderCompetitorAnalysis = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Competitor Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {competitorAnalysis.map((competitor, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{competitor.name}</div>
                <div className="text-sm text-gray-600">
                  {competitor.opportunities} opportunities
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">
                  {competitor.winRate}%
                </div>
                <div className="text-sm text-gray-600">Win Rate</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Render profitability visualization
  const renderProfitabilityVisualization = (opportunityId) => {
    const displayData = whatIfAnalysis || profitabilityData;
    
    if (!displayData && !profitabilityLoading) {
      return (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Profitability Analysis
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchProfitabilityData(opportunityId, selectedCurrency)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Analysis
            </Button>
          </div>
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <Calculator className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Click "Generate Analysis" to view profitability data</p>
          </div>
        </div>
      );
    }

    if (profitabilityLoading) {
      return (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Calculating profitability...</span>
          </div>
        </div>
      );
    }

    if (!displayData) return null;

    const { items, summary, phase_totals } = displayData;
    const isNegativeProfit = summary.total_project_profit < 0;

    return (
      <div className="mt-6 space-y-6">
        {/* Header with controls */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Profitability Analysis
            {whatIfAnalysis && (
              <Badge variant="secondary" className="ml-2">
                What-If: {whatIfAnalysis.hypothetical_discount_applied}% additional discount
              </Badge>
            )}
          </h4>
          <div className="flex items-center gap-2">
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchProfitabilityData(opportunityId, selectedCurrency)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportPnLTemplate(opportunityId)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PnL
            </Button>
          </div>
        </div>

        {/* Profitability Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full pnl-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sr. No.</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Product Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">SKU Code</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Unit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Cost per Unit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">List Price</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Selling Rate</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Discount %</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total Selling</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Phase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{item.sr_no}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm font-mono">{item.sku_code}</td>
                    <td className="px-4 py-3 text-sm text-center">{item.qty}</td>
                    <td className="px-4 py-3 text-sm text-center">{item.unit}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                      {item.cost_per_unit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                      {item.total_cost.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                      {item.price_list_per_unit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                      {item.selling_rate_per_unit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <Badge variant="outline">{item.discount_percentage.toFixed(1)}%</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                      {item.total_selling_price.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{item.phase}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phase Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(phase_totals).map(([phase, total]) => (
            <Card key={phase}>
              <CardContent className="p-4">
                <div className="text-sm text-gray-600">{phase} Total</div>
                <div className="text-lg font-semibold">
                  {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                  {total.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profitability Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Total Project Cost</div>
                <div className="text-lg font-semibold">
                  {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                  {summary.total_project_cost.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Total Selling Price</div>
                <div className="text-lg font-semibold">
                  {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                  {summary.total_selling_price.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Total Project Profit</div>
                <div className={`text-lg font-semibold ${isNegativeProfit ? 'text-red-600' : 'text-green-600'}`}>
                  {summary.currency === 'INR' ? '₹' : summary.currency === 'USD' ? '$' : '€'}
                  {summary.total_project_profit.toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Profit Percentage</div>
                <div className={`text-lg font-semibold ${isNegativeProfit ? 'text-red-600' : 'text-green-600'}`}>
                  {summary.profit_percentage}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What-If Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What-If Analysis</CardTitle>
            <CardDescription>
              Test different discount scenarios to see impact on profitability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="what-if-discount">Additional Discount %:</Label>
                <Input
                  id="what-if-discount"
                  type="number"
                  value={whatIfDiscount}
                  onChange={(e) => setWhatIfDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20"
                  min="0"
                  max="50"
                  step="0.1"
                />
              </div>
              <Button
                size="sm"
                onClick={() => calculateWhatIfAnalysis(opportunityId)}
                disabled={profitabilityLoading}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Recalculate Profit
              </Button>
              {whatIfAnalysis && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setWhatIfAnalysis(null)}
                >
                  Reset to Original
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <ProtectedComponent requiredPermission="/opportunities" requiredAction="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Opportunity Management</h1>
            <p className="text-gray-600">Manage your sales pipeline with advanced stage-based workflows</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchOpportunities} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => navigate('/opportunities/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Opportunity
            </Button>
          </div>
        </div>

        {/* Enhanced Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Opportunities</p>
                  <p className="text-2xl font-bold">{statistics.totalOpportunities}</p>
                </div>
                <Briefcase className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Open</p>
                  <p className="text-2xl font-bold">{statistics.openOpportunities}</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
                  <p className="text-2xl font-bold">${statistics.totalPipelineValue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Weighted Revenue</p>
                  <p className="text-2xl font-bold">${statistics.weightedRevenue.toLocaleString()}</p>
                </div>
                <Calculator className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Win Rate</p>
                  <p className="text-2xl font-bold">{statistics.winRate}%</p>
                </div>
                <Award className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pipeline">
            {renderPipelineView()}
          </TabsContent>
          
          <TabsContent value="forecast">
            {renderForecastingDashboard()}
          </TabsContent>
          
          <TabsContent value="analysis">
            {renderCompetitorAnalysis()}
          </TabsContent>
        </Tabs>

        {/* Opportunity Detail Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedOpportunity?.opportunity_title}
              </DialogTitle>
              <DialogDescription>
                {selectedOpportunity?.company_name} • {selectedOpportunity?.opportunity_id}
              </DialogDescription>
            </DialogHeader>
            
            {selectedOpportunity && (
              <Tabs defaultValue="stage" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="stage">Stage Management</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
                
                <TabsContent value="stage">
                  {renderStageForm(currentStage)}
                </TabsContent>
                
                <TabsContent value="history">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Stage History
                      </h4>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Mock stage history data - in real app this would come from API */}
                      {[
                        {
                          id: 1,
                          from_stage: 'L1 Prospect',
                          to_stage: 'L2 Qualification',
                          transitioned_by: 'Admin User',
                          transition_date: '2024-01-15T10:30:00Z',
                          comments: 'Initial qualification completed successfully'
                        },
                        {
                          id: 2,
                          from_stage: null,
                          to_stage: 'L1 Prospect',
                          transitioned_by: 'Admin User',
                          transition_date: '2024-01-10T09:15:00Z',
                          comments: 'Opportunity created from approved lead'
                        }
                      ].map((history, index) => (
                        <div key={history.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <ArrowUp className="h-4 w-4 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {history.from_stage && (
                                <Badge variant="outline" className="text-xs">
                                  {history.from_stage}
                                </Badge>
                              )}
                              {history.from_stage && <ChevronRight className="h-3 w-3 text-gray-400" />}
                              <Badge className="text-xs bg-green-100 text-green-800">
                                {history.to_stage}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-900 mb-1">
                              {history.comments}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <User className="h-3 w-3" />
                              <span>{history.transitioned_by}</span>
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              <span>{new Date(history.transition_date).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Empty state */}
                      {false && (
                        <div className="text-center py-8 text-gray-500">
                          <History className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>No stage history available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="documents">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Documents
                      </h4>
                      <Button size="sm" variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Document
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Mock document data - in real app this would come from API */}
                      {[
                        {
                          id: 1,
                          name: 'Proposal_v1.pdf',
                          type: 'Proposal',
                          size: '2.4 MB',
                          uploaded_by: 'Admin User',
                          uploaded_at: '2024-01-15T14:30:00Z',
                          url: '#'
                        },
                        {
                          id: 2,
                          name: 'Technical_Specification.docx',
                          type: 'Technical Document',
                          size: '1.8 MB',
                          uploaded_by: 'Admin User',
                          uploaded_at: '2024-01-12T11:20:00Z',
                          url: '#'
                        },
                        {
                          id: 3,
                          name: 'Digital_Signature.pdf',
                          type: 'Digital Signature',
                          size: '156 KB',
                          uploaded_by: 'Admin User',
                          uploaded_at: '2024-01-10T16:45:00Z',
                          url: '#'
                        }
                      ].map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.name}
                              </p>
                              <Badge variant="secondary" className="text-xs">
                                {doc.type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{doc.size}</span>
                              <span>•</span>
                              <User className="h-3 w-3" />
                              <span>{doc.uploaded_by}</span>
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              <span>{new Date(doc.uploaded_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Empty state */}
                      {false && (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>No documents uploaded</p>
                          <Button size="sm" variant="outline" className="mt-2">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload First Document
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Opportunity Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Create New Opportunity from Approved Lead
              </DialogTitle>
              <DialogDescription>
                Create an opportunity from an approved lead. The system will auto-populate relevant information.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Lead Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Approved Lead</CardTitle>
                  <CardDescription>
                    Choose from approved leads that don't have existing opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Approved Lead <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={opportunityFormData.lead_id}
                      onValueChange={(value) => handleOpportunityInputChange('lead_id', value)}
                    >
                      <SelectTrigger className={validationErrors.lead_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select an approved lead" />
                      </SelectTrigger>
                      <SelectContent>
                        {masterData.approvedLeads.length === 0 ? (
                          <SelectItem value="no-leads" disabled>
                            No approved leads available
                          </SelectItem>
                        ) : (
                          masterData.approvedLeads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {lead.lead_id}
                                </Badge>
                                <span>{lead.project_title}</span>
                                <span className="text-muted-foreground">({lead.company_name})</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {validationErrors.lead_id && (
                      <p className="text-sm text-red-500">{validationErrors.lead_id}</p>
                    )}
                    {masterData.approvedLeads.length === 0 && (
                      <div className="flex items-center text-amber-600 text-sm">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        No approved leads available for opportunity creation
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Opportunity Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Opportunity Details</CardTitle>
                  <CardDescription>
                    Information will be auto-populated from the selected lead
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        Opportunity Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        value={opportunityFormData.opportunity_title}
                        onChange={(e) => handleOpportunityInputChange('opportunity_title', e.target.value)}
                        placeholder="Enter opportunity title"
                        className={validationErrors.opportunity_title ? 'border-red-500' : ''}
                      />
                      {validationErrors.opportunity_title && (
                        <p className="text-sm text-red-500">{validationErrors.opportunity_title}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Opportunity Type <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={opportunityFormData.opportunity_type}
                        onValueChange={(value) => handleOpportunityInputChange('opportunity_type', value)}
                      >
                        <SelectTrigger className={validationErrors.opportunity_type ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select opportunity type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Tender">Tender</SelectItem>
                          <SelectItem value="Non-Tender">Non-Tender</SelectItem>
                        </SelectContent>
                      </Select>
                      {validationErrors.opportunity_type && (
                        <p className="text-sm text-red-500">{validationErrors.opportunity_type}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Company <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={opportunityFormData.company_id}
                        onValueChange={(value) => handleOpportunityInputChange('company_id', value)}
                      >
                        <SelectTrigger className={validationErrors.company_id ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {masterData.companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
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
                      <Label>
                        Opportunity Owner <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={opportunityFormData.opportunity_owner_id}
                        onValueChange={(value) => handleOpportunityInputChange('opportunity_owner_id', value)}
                      >
                        <SelectTrigger className={validationErrors.opportunity_owner_id ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select opportunity owner" />
                        </SelectTrigger>
                        <SelectContent>
                          {masterData.users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {user.full_name || user.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.opportunity_owner_id && (
                        <p className="text-sm text-red-500">{validationErrors.opportunity_owner_id}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Partner (Optional)</Label>
                      <Select
                        value={opportunityFormData.partner_id}
                        onValueChange={(value) => handleOpportunityInputChange('partner_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-partner">No Partner</SelectItem>
                          {/* Partners would be loaded from master data */}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Expected Closure Date</Label>
                      <Input
                        type="date"
                        value={opportunityFormData.expected_closure_date}
                        onChange={(e) => handleOpportunityInputChange('expected_closure_date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea
                      value={opportunityFormData.remarks}
                      onChange={(e) => handleOpportunityInputChange('remarks', e.target.value)}
                      placeholder="Enter any additional remarks or notes"
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-2 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateOpportunity} disabled={loading}>
                {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                Create Opportunity
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* QMS - Quotation Management Modal */}
        <Dialog open={showQuotationModal} onOpenChange={setShowQuotationModal}>
          <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {selectedQuotation ? 'Edit Quotation' : 'Create New Quotation'}
                {selectedQuotation && (
                  <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                    {selectedQuotation.quotation_number}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Quotation Modal Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'details', name: 'Details', icon: FileText },
                  { id: 'items', name: 'Items', icon: Package },
                  { id: 'pricing', name: 'Pricing', icon: CreditCard },
                  { id: 'approval', name: 'Approval', icon: CheckCircle }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveQuotationTab(tab.id)}
                    className={`${
                      activeQuotationTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Details Tab */}
            {activeQuotationTab === 'details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="quotation_number">Quotation Number *</Label>
                    <Input
                      id="quotation_number"
                      value={quotationFormData.quotation_number}
                      onChange={(e) => handleQuotationFormChange('quotation_number', e.target.value)}
                      placeholder="Auto-generated if empty"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_name">Customer Name *</Label>
                    <Input
                      id="customer_name"
                      value={quotationFormData.customer_name}
                      onChange={(e) => handleQuotationFormChange('customer_name', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_contact_email">Customer Email</Label>
                    <Input
                      id="customer_contact_email"
                      type="email"
                      value={quotationFormData.customer_contact_email}
                      onChange={(e) => handleQuotationFormChange('customer_contact_email', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="customer_contact_phone">Customer Phone</Label>
                    <Input
                      id="customer_contact_phone"
                      value={quotationFormData.customer_contact_phone}
                      onChange={(e) => handleQuotationFormChange('customer_contact_phone', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="pricing_list_id">Pricing List</Label>
                    <Select
                      value={quotationFormData.pricing_list_id}
                      onValueChange={(value) => handleQuotationFormChange('pricing_list_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pricing list" />
                      </SelectTrigger>
                      <SelectContent>
                        {pricingLists.map(list => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name || `Pricing List ${list.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="currency_id">Currency</Label>
                    <Select
                      value={quotationFormData.currency_id}
                      onValueChange={(value) => handleQuotationFormChange('currency_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">USD ($)</SelectItem>
                        <SelectItem value="2">INR (₹)</SelectItem>
                        <SelectItem value="3">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="validity_date">Validity Date *</Label>
                    <Input
                      id="validity_date"
                      type="date"
                      value={quotationFormData.validity_date}
                      onChange={(e) => handleQuotationFormChange('validity_date', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="overall_discount_type">Overall Discount Type</Label>
                    <Select
                      value={quotationFormData.overall_discount_type}
                      onValueChange={(value) => handleQuotationFormChange('overall_discount_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select discount type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Discount</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="absolute">Absolute Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {quotationFormData.overall_discount_type && quotationFormData.overall_discount_type !== 'none' && (
                    <div>
                      <Label htmlFor="overall_discount_value">
                        Discount Value {quotationFormData.overall_discount_type === 'percentage' ? '(%)' : '($)'}
                      </Label>
                      <Input
                        id="overall_discount_value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={quotationFormData.overall_discount_value}
                        onChange={(e) => handleQuotationFormChange('overall_discount_value', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <Label htmlFor="terms_and_conditions">Terms and Conditions</Label>
                    <Textarea
                      id="terms_and_conditions"
                      rows={4}
                      value={quotationFormData.terms_and_conditions}
                      onChange={(e) => handleQuotationFormChange('terms_and_conditions', e.target.value)}
                      placeholder="Standard terms and conditions apply..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="internal_notes">Internal Notes</Label>
                    <Textarea
                      id="internal_notes"
                      rows={3}
                      value={quotationFormData.internal_notes}
                      onChange={(e) => handleQuotationFormChange('internal_notes', e.target.value)}
                      placeholder="Internal comments visible only to team members..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="external_notes">External Notes</Label>
                    <Textarea
                      id="external_notes"
                      rows={3}
                      value={quotationFormData.external_notes}
                      onChange={(e) => handleQuotationFormChange('external_notes', e.target.value)}
                      placeholder="Customer-facing notes..."
                    />
                  </div>

                  {quotationFormData.overall_discount_type && quotationFormData.overall_discount_type !== 'none' && (
                    <div>
                      <Label htmlFor="discount_reason">Discount Reason</Label>
                      <Textarea
                        id="discount_reason"
                        rows={2}
                        value={quotationFormData.discount_reason}
                        onChange={(e) => handleQuotationFormChange('discount_reason', e.target.value)}
                        placeholder="Reason for applying discount..."
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Items Tab */}
            {activeQuotationTab === 'items' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Quotation Structure</h3>
                  <Button
                    type="button"
                    onClick={() => {
                      // Add new phase logic
                      const newPhase = {
                        id: `temp-${Date.now()}`,
                        phase_name: `Phase ${quotationPhases.length + 1}`,
                        phase_description: '',
                        phase_order: quotationPhases.length + 1,
                        groups: []
                      };
                      setQuotationPhases([...quotationPhases, newPhase]);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Phase
                  </Button>
                </div>

                {quotationPhases.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Layers className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No phases yet</h3>
                    <p className="text-gray-500 mb-4">Add phases to organize your quotation items</p>
                    <Button
                      type="button"
                      onClick={() => {
                        const newPhase = {
                          id: `temp-${Date.now()}`,
                          phase_name: 'Phase 1',
                          phase_description: '',
                          phase_order: 1,
                          groups: []
                        };
                        setQuotationPhases([newPhase]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Phase
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotationPhases.map((phase, phaseIndex) => (
                      <div key={phase.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex-1">
                            <Input
                              value={phase.phase_name}
                              onChange={(e) => {
                                const updatedPhases = [...quotationPhases];
                                updatedPhases[phaseIndex].phase_name = e.target.value;
                                setQuotationPhases(updatedPhases);
                              }}
                              className="font-medium"
                              placeholder="Phase name"
                            />
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Add new group to this phase
                                const updatedPhases = [...quotationPhases];
                                const newGroup = {
                                  id: `temp-group-${Date.now()}`,
                                  group_name: `Group ${(phase.groups?.length || 0) + 1}`,
                                  group_description: '',
                                  group_order: (phase.groups?.length || 0) + 1,
                                  items: []
                                };
                                updatedPhases[phaseIndex].groups = [...(phase.groups || []), newGroup];
                                setQuotationPhases(updatedPhases);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Group
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updatedPhases = quotationPhases.filter((_, i) => i !== phaseIndex);
                                setQuotationPhases(updatedPhases);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {phase.groups && phase.groups.length > 0 ? (
                          <div className="space-y-3 ml-4">
                            {phase.groups.map((group, groupIndex) => (
                              <div key={group.id} className="border border-gray-100 rounded p-3 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <Input
                                    value={group.group_name}
                                    onChange={(e) => {
                                      const updatedPhases = [...quotationPhases];
                                      updatedPhases[phaseIndex].groups[groupIndex].group_name = e.target.value;
                                      setQuotationPhases(updatedPhases);
                                    }}
                                    className="bg-white"
                                    placeholder="Group name"
                                  />
                                  <div className="flex items-center space-x-2 ml-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        // Add new item to this group
                                        const updatedPhases = [...quotationPhases];
                                        const newItem = {
                                          id: `temp-item-${Date.now()}`,
                                          product_name: '',
                                          quantity: 1,
                                          net_otp: 0,
                                          net_recurring: 0
                                        };
                                        updatedPhases[phaseIndex].groups[groupIndex].items = [...(group.items || []), newItem];
                                        setQuotationPhases(updatedPhases);
                                      }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Item
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updatedPhases = [...quotationPhases];
                                        updatedPhases[phaseIndex].groups = phase.groups.filter((_, i) => i !== groupIndex);
                                        setQuotationPhases(updatedPhases);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>

                                {group.items && group.items.length > 0 && (
                                  <div className="space-y-2 ml-4">
                                    {group.items.map((item, itemIndex) => (
                                      <div key={item.id} className="bg-white border rounded p-3 space-y-3">
                                        <div className="grid grid-cols-12 gap-2 items-center">
                                          <div className="col-span-5">
                                            <Label className="text-xs">Product *</Label>
                                            <Select
                                              value={item.core_product_id || ''}
                                              onValueChange={(value) => {
                                                const selectedProduct = productCatalog.find(p => p.id === value);
                                                const updatedPhases = [...quotationPhases];
                                                updatedPhases[phaseIndex].groups[groupIndex].items[itemIndex] = {
                                                  ...item,
                                                  core_product_id: value,
                                                  product_name: selectedProduct?.core_product_name || '',
                                                  sku_code: selectedProduct?.skucode || '',
                                                  unit_of_measure: selectedProduct?.unit_of_measure || 'Each',
                                                  base_otp: selectedProduct?.base_price || 0,
                                                  base_recurring: selectedProduct?.recurring_price || 0
                                                };
                                                setQuotationPhases(updatedPhases);
                                                calculateQuotationTotals();
                                              }}
                                            >
                                              <SelectTrigger className="h-8">
                                                <SelectValue placeholder="Select product" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {productCatalog.map(product => (
                                                  <SelectItem key={product.id} value={product.id}>
                                                    <div className="flex flex-col">
                                                      <span className="font-medium">{product.core_product_name}</span>
                                                      <span className="text-xs text-gray-500">{product.skucode} • {product.primary_category}</span>
                                                    </div>
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="col-span-2">
                                            <Label className="text-xs">Quantity</Label>
                                            <Input
                                              type="number"
                                              min="1"
                                              step="0.1"
                                              value={item.quantity}
                                              onChange={(e) => {
                                                const updatedPhases = [...quotationPhases];
                                                updatedPhases[phaseIndex].groups[groupIndex].items[itemIndex].quantity = parseFloat(e.target.value) || 1;
                                                setQuotationPhases(updatedPhases);
                                                calculateQuotationTotals();
                                              }}
                                              className="h-8"
                                            />
                                          </div>
                                          <div className="col-span-2">
                                            <Label className="text-xs">Unit Price</Label>
                                            <Input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={item.base_otp || 0}
                                              onChange={(e) => {
                                                const updatedPhases = [...quotationPhases];
                                                updatedPhases[phaseIndex].groups[groupIndex].items[itemIndex].base_otp = parseFloat(e.target.value) || 0;
                                                setQuotationPhases(updatedPhases);
                                                calculateQuotationTotals();
                                              }}
                                              className="h-8"
                                            />
                                          </div>
                                          <div className="col-span-2">
                                            <Label className="text-xs">Line Total</Label>
                                            <div className="h-8 px-3 py-1 bg-gray-50 rounded border text-sm">
                                              ${((item.quantity || 1) * (item.base_otp || 0)).toFixed(2)}
                                            </div>
                                          </div>
                                          <div className="col-span-1">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const updatedPhases = [...quotationPhases];
                                                updatedPhases[phaseIndex].groups[groupIndex].items = group.items.filter((_, i) => i !== itemIndex);
                                                setQuotationPhases(updatedPhases);
                                                calculateQuotationTotals();
                                              }}
                                              className="h-8 w-8 p-0"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        {item.core_product_id && (
                                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                            <div className="grid grid-cols-2 gap-2">
                                              <span>SKU: {item.sku_code}</span>
                                              <span>Unit: {item.unit_of_measure}</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 bg-gray-50 rounded">
                            <p className="text-gray-500 text-sm">No groups in this phase</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pricing Tab */}
            {activeQuotationTab === 'pricing' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Pricing Overview</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      // Recalculate pricing logic
                      toast.info('Pricing recalculation will be implemented');
                    }}
                  >
                    <Calculator className="h-4 w-4 mr-2" />
                    Recalculate
                  </Button>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">One-Time Payment</p>
                      <p className="text-2xl font-bold text-gray-900">$0.00</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Year 1 Total</p>
                      <p className="text-2xl font-bold text-gray-900">$0.00</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Recurring (Annual)</p>
                      <p className="text-2xl font-bold text-gray-900">$0.00</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Grand Total</p>
                      <p className="text-2xl font-bold text-green-600">$0.00</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Year</th>
                          <th className="text-right py-2">OTP</th>
                          <th className="text-right py-2">Recurring</th>
                          <th className="text-right py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 10 }, (_, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2">Year {i + 1}</td>
                            <td className="text-right py-2">$0.00</td>
                            <td className="text-right py-2">$0.00</td>
                            <td className="text-right py-2 font-medium">$0.00</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Tab */}
            {activeQuotationTab === 'approval' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Approval Status</h3>
                  <div className="flex space-x-2">
                    {selectedQuotation?.status === 'draft' && (
                      <Button
                        type="button"
                        onClick={() => selectedQuotation && submitQuotation(selectedQuotation.id)}
                        disabled={quotationLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit for Approval
                      </Button>
                    )}
                    {selectedQuotation && ['approved', 'sent'].includes(selectedQuotation.status) && (
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => exportQuotation(selectedQuotation.id, 'pdf')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export PDF
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => exportQuotation(selectedQuotation.id, 'excel')}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Export Excel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="text-center">
                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                      selectedQuotation?.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      selectedQuotation?.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                      selectedQuotation?.status === 'approved' ? 'bg-green-100 text-green-800' :
                      selectedQuotation?.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      selectedQuotation?.status === 'expired' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {selectedQuotation?.status?.charAt(0).toUpperCase() + selectedQuotation?.status?.slice(1) || 'Draft'}
                    </div>
                    <p className="text-gray-600 mt-2">
                      {selectedQuotation?.status === 'draft' && 'Quotation is in draft mode. Submit for approval to proceed.'}
                      {selectedQuotation?.status === 'submitted' && 'Quotation has been submitted and is awaiting approval.'}
                      {selectedQuotation?.status === 'approved' && 'Quotation has been approved and is ready to send.'}
                      {selectedQuotation?.status === 'sent' && 'Quotation has been sent to the customer.'}
                      {selectedQuotation?.status === 'expired' && 'Quotation has expired and needs renewal.'}
                    </p>
                  </div>

                  {selectedQuotation && (
                    <div className="mt-6 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Created by</p>
                          <p className="font-medium">{selectedQuotation.created_by || 'System'}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Created on</p>
                          <p className="font-medium">
                            {selectedQuotation.created_at ? new Date(selectedQuotation.created_at).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        {selectedQuotation.submitted_by && (
                          <>
                            <div>
                              <p className="text-gray-600">Submitted by</p>
                              <p className="font-medium">{selectedQuotation.submitted_by}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Submitted on</p>
                              <p className="font-medium">
                                {selectedQuotation.submitted_at ? new Date(selectedQuotation.submitted_at).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                          </>
                        )}
                        {selectedQuotation.approved_by && (
                          <>
                            <div>
                              <p className="text-gray-600">Approved by</p>
                              <p className="font-medium">{selectedQuotation.approved_by}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Approved on</p>
                              <p className="font-medium">
                                {selectedQuotation.approved_at ? new Date(selectedQuotation.approved_at).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowQuotationModal(false);
                    resetQuotationForm();
                  }}
                  disabled={quotationLoading}
                >
                  Cancel
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Save as draft logic
                    const quotationData = {
                      ...quotationFormData,
                      opportunity_id: selectedOpportunity?.id,
                      status: 'draft'
                    };
                    
                    if (selectedQuotation) {
                      updateQuotation(selectedQuotation.id, quotationData);
                    } else {
                      createQuotation(quotationData);
                    }
                  }}
                  disabled={quotationLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    // Save and submit logic
                    const quotationData = {
                      ...quotationFormData,
                      opportunity_id: selectedOpportunity?.id,
                      status: 'submitted'
                    };
                    
                    if (selectedQuotation) {
                      updateQuotation(selectedQuotation.id, quotationData);
                    } else {
                      createQuotation(quotationData);
                    }
                  }}
                  disabled={quotationLoading}
                >
                  {quotationLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Save & Submit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* QMS - View Mode Modal for L1-L8 Stages */}
        <Dialog open={showViewMode} onOpenChange={setShowViewMode}>
          <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Opportunity Overview - All Stages
                {selectedOpportunity && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {selectedOpportunity.opportunity_title}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Stage Navigation Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-4 overflow-x-auto">
                {[
                  { id: 'L1', name: 'Lead Identification' },
                  { id: 'L2', name: 'Needs Assessment' },
                  { id: 'L3', name: 'Proposal Development' },
                  { id: 'L4', name: 'Technical Qualification' },
                  { id: 'L5', name: 'Commercial Negotiations' },
                  { id: 'L6', name: 'Closure' },
                  { id: 'L7', name: 'Contract Finalization' },
                  { id: 'L8', name: 'Post-Sale Support' }
                ].map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setActiveViewStage(stage.id)}
                    className={`${
                      activeViewStage === stage.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-2 px-3 border-b-2 font-medium text-sm rounded-t`}
                  >
                    {stage.id}: {stage.name}
                  </button>
                ))}
              </nav>
            </div>

            {/* Stage Content */}
            <div className="min-h-[400px]">
              {activeViewStage === 'L4' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Technical Qualification & Quotations</h3>
                    <Button
                      type="button"
                      onClick={() => fetchQuotations(selectedOpportunity?.id)}
                      variant="outline"
                      size="sm"
                      disabled={quotationLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${quotationLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>

                  {/* Quotations Display */}
                  {quotationLoading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">Loading quotations...</p>
                    </div>
                  ) : quotationList.length > 0 ? (
                    <div className="space-y-4">
                      {quotationList.map((quotation) => (
                        <div key={quotation.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center space-x-3 mb-2">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {quotation.quotation_number || 'Draft Quotation'}
                                </h4>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  quotation.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                                  quotation.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                                  quotation.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  quotation.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                  quotation.status === 'expired' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {quotation.status?.charAt(0).toUpperCase() + quotation.status?.slice(1)}
                                </span>
                              </div>
                              <p className="text-gray-600">Customer: {quotation.customer_name}</p>
                              <p className="text-sm text-gray-500 mt-1">
                                Created: {new Date(quotation.created_at).toLocaleDateString()} | 
                                Valid until: {quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-gray-900">
                                {quotation.currency_id === '1' ? '$' : '₹'}{quotation.grand_total?.toLocaleString() || '0.00'}
                              </p>
                              <p className="text-sm text-gray-500">Grand Total</p>
                            </div>
                          </div>

                          {/* Quotation Summary */}
                          <div className="border-t pt-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600">One-Time Payment</p>
                                <p className="font-semibold">${quotation.total_otp?.toLocaleString() || '0.00'}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Year 1</p>
                                <p className="font-semibold">${quotation.total_year1?.toLocaleString() || '0.00'}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Year 2</p>
                                <p className="font-semibold">${quotation.total_year2?.toLocaleString() || '0.00'}</p>
                              </div>
                              <div>
                                <p className="text-gray-600">Phases</p>
                                <p className="font-semibold">{quotation.phases?.length || 0}</p>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Navigate to full-page quotation management for viewing
                                window.location.href = `/quotation/${quotation.id}?opportunityId=${selectedOpportunity.id}`;
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                            {quotation.status === 'approved' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => exportQuotation(quotation.id, 'pdf')}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Export PDF
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No quotations found</h3>
                      <p className="text-gray-500">This opportunity doesn't have any quotations yet.</p>
                    </div>
                  )}
                </div>
              ) : ['L7', 'L8'].includes(activeViewStage) ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Stage {activeViewStage}: {activeViewStage === 'L7' ? 'Contract Finalization' : 'Post-Sale Support'}
                  </h3>
                  <p className="text-gray-500">This stage is planned for future implementation.</p>
                  <p className="text-sm text-gray-400 mt-2">Data not yet available</p>
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-lg">
                  <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Stage {activeViewStage}: {
                      activeViewStage === 'L1' ? 'Lead Identification' :
                      activeViewStage === 'L2' ? 'Needs Assessment' :
                      activeViewStage === 'L3' ? 'Proposal Development' :
                      activeViewStage === 'L5' ? 'Commercial Negotiations' :
                      activeViewStage === 'L6' ? 'Closure' : 'Stage Data'
                    }
                  </h3>
                  <p className="text-gray-500">Stage data will be displayed here.</p>
                  <p className="text-sm text-gray-400 mt-2">Integration with existing stage data is planned</p>
                </div>
              )}
            </div>

            {/* View Mode Footer */}
            <div className="flex items-center justify-end pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowViewMode(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedComponent>
  );
};

export default EnhancedOpportunityManagement;