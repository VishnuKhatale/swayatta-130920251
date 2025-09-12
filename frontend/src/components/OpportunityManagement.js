import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Textarea } from './ui/textarea.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx';
import { Badge } from './ui/badge.jsx';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle,
  Clock,
  Circle,
  AlertTriangle,
  FileText,
  DollarSign,
  Users,
  Building,
  Target,
  Plus,
  Eye,
  Upload,
  Trash2
} from 'lucide-react';
import axios from 'axios';

const OpportunityManagement = () => {
  const { opportunityId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine mode from route
  const isViewMode = location.pathname.includes('/opportunities/') && !location.pathname.includes('/edit') && !location.pathname.includes('/new');
  const isCreateMode = location.pathname.includes('/new');

  // Get initial stage from URL or default
  const getInitialStage = () => {
    const params = new URLSearchParams(location.search);
    return params.get('stage') || 'L1';
  };

  // Core state
  const [currentStage, setCurrentStage] = useState(getInitialStage());
  const [opportunity, setOpportunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Stage form data - exactly matching the existing modal structure
  const [stageFormData, setStageFormData] = useState({});
  
  // Stage progress tracking
  const [stageStatuses, setStageStatuses] = useState({});

  // Master data
  const [masterData, setMasterData] = useState({
    regions: [],
    products: [],
    users: [],
    currencies: []
  });

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
  };

  // Exact stage configuration from existing modal
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
          { name: 'currency', label: 'Currency', type: 'select', options: masterData.currencies?.map(c => ({ 
            id: c.currency_code, 
            name: `${c.currency_name} (${c.currency_symbol})` 
          })) || [
            { id: 'INR', name: 'Indian Rupee (₹)' },
            { id: 'USD', name: 'US Dollar ($)' }
          ], required: true, defaultValue: 'INR' },
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
        const l5Fields = [
          { name: 'updated_pricing', label: 'Updated Pricing', type: 'number', required: true, minValue: 0.01 },
          { name: 'margin_check', label: 'Margin Check (%)', type: 'number', required: true },
          { 
            name: 'commercial_decision', 
            label: 'Commercial Decision', 
            type: 'select', 
            required: true,
            options: [
              { id: 'Won', name: 'Won (Approve)' },
              { id: 'Reject', name: 'Reject' }
            ],
            roleGated: true // Only Admin/Sales Manager/Commercial Approver
          },
          { name: 'terms_conditions', label: 'T&C', type: 'textarea', expandable: true },
          { name: 'legal_doc_status', label: 'Legal Doc Status', type: 'select', options: [
            { id: 'Draft', name: 'Draft' },
            { id: 'Under Review', name: 'Under Review' },
            { id: 'Approved', name: 'Approved' },
            { id: 'Rejected', name: 'Rejected' }
          ]},
          { name: 'po_number', label: 'PO Number', type: 'text', required: true },
          { name: 'po_date', label: 'PO Date', type: 'date' },
          { name: 'po_amount', label: 'PO Amount', type: 'currency' },
          { name: 'po_file', label: 'PO File (PDF/DOC)', type: 'file', accept: '.pdf,.doc,.docx' },
          { name: 'po_status', label: 'PO Status', type: 'select', options: [
            { id: 'Pending', name: 'Pending' },
            { id: 'Received', name: 'Received' },
            { id: 'Verified', name: 'Verified' }
          ]},
          ...commonFields
        ];
        
        // Add admin-only fields for internal cost visibility
        if (userPermissions.can_view_internal_costs) {
          l5Fields.push({ name: 'cpc', label: 'CPC (Internal)', type: 'number', adminOnly: true });
          l5Fields.push({ name: 'overhead', label: 'Overhead (Internal)', type: 'number', adminOnly: true });
        }
        
        return l5Fields;
      
      case 'L6': // Won
        return [
          { name: 'final_value', label: 'Final Value', type: 'currency', required: true, minValue: 0.01 },
          { name: 'client_poc', label: 'Client PoC', type: 'text', validation: 'contact' },
          { name: 'handover_status', label: 'Handover Status', type: 'select', options: [
            { id: 'Pending', name: 'Pending' },
            { id: 'In Progress', name: 'In Progress' },
            { id: 'Complete', name: 'Complete' }
          ], required: true },
          { name: 'delivery_team', label: 'Delivery Team', type: 'multiselect', options: masterData.users },
          { name: 'kickoff_task', label: 'Kickoff Task', type: 'textarea', maxLength: 1000 },
          { name: 'revenue_recognition', label: 'Revenue Recognition Flag', type: 'checkbox', audited: true }
        ];
      
      case 'L7': // Lost
        return [
          { name: 'lost_reason', label: 'Lost Reason', type: 'select', options: [
            { id: 'Price Too High', name: 'Price Too High' },
            { id: 'Lost to Competitor', name: 'Lost to Competitor' },
            { id: 'Budget Constraints', name: 'Budget Constraints' },
            { id: 'Timeline Mismatch', name: 'Timeline Mismatch' },
            { id: 'Technical Requirements', name: 'Technical Requirements' },
            { id: 'Other', name: 'Other' }
          ], required: true },
          { name: 'competitor', label: 'Competitor', type: 'text', requiredIf: { field: 'lost_reason', value: 'Lost to Competitor' } },
          { name: 'followup_reminder', label: 'Follow-Up Reminder', type: 'date', defaultValue: '+6months' },
          { name: 'internal_learnings', label: 'Internal Learnings', type: 'textarea', maxLength: 1000 },
          { name: 'escalation_flag', label: 'Escalation Flag', type: 'checkbox', conditional: true }
        ];
      
      case 'L8': // Dropped
        return [
          { name: 'drop_reason', label: 'Drop Reason', type: 'select', options: [
            { id: 'Client Inactive', name: 'Client Inactive' },
            { id: 'Budget Frozen', name: 'Budget Frozen' },
            { id: 'Project Cancelled', name: 'Project Cancelled' },
            { id: 'Unresponsive', name: 'Unresponsive' },
            { id: 'Internal Resource Constraints', name: 'Internal Resource Constraints' },
            { id: 'Other', name: 'Other' }
          ], required: true },
          { name: 'auto_drop_logic', label: 'Auto-Drop Logic', type: 'display', value: '30 days of inactivity', readOnly: true },
          { name: 're_nurture_tag', label: 'Re-Nurture Tag', type: 'checkbox' },
          { name: 'reminder_date', label: 'Reminder Date (for reactivation)', type: 'date' },
          { name: 'reactivation', label: 'Reactivation', type: 'button', action: 'reactivateOpportunity' }
        ];
      
      default:
        return [];
    }
  };

  // Stage configuration with icons and descriptions
  const stageConfig = {
    L1: { name: 'Prospect', icon: Target, description: 'Initial opportunity identification' },
    L2: { name: 'Qualification', icon: CheckCircle, description: 'BANT/CHAMP qualification process' },
    L3: { name: 'Proposal/Bid', icon: FileText, description: 'Proposal submission and tracking' },
    L4: { name: 'Technical Qualification', icon: Building, description: 'Technical evaluation and quotation' },
    L5: { name: 'Commercial Negotiations', icon: DollarSign, description: 'Pricing and terms finalization' },
    L6: { name: 'Won', icon: CheckCircle, description: 'Opportunity won and handover' },
    L7: { name: 'Lost', icon: Circle, description: 'Opportunity lost analysis' },
    L8: { name: 'Dropped', icon: Circle, description: 'Opportunity dropped or inactive' }
  };

  // Additional state for quotation management and stage gating
  const [quotations, setQuotations] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});
  const [stageAccess, setStageAccess] = useState({});
  const [currentUser, setCurrentUser] = useState(null);

  // Load opportunity data
  useEffect(() => {
    // Suppress analytics errors that could block UI
    window.addEventListener('error', (event) => {
      if (event.error?.message?.includes('posthog') || 
          event.filename?.includes('posthog') ||
          event.filename?.includes('i.posthog.com')) {
        console.warn('Analytics error suppressed:', event.error);
        event.preventDefault();
        return false;
      }
    });

    if (isCreateMode) {
      setLoading(false);
      setOpportunity({ id: 'new' });
      calculateStageStatuses({});
    } else if (opportunityId) {
      loadOpportunity();
      loadQuotations();
      loadUserPermissions();
      loadCurrentUser();
    }
    loadMasterData();
  }, [opportunityId, isCreateMode]);

  // Handle quotation refresh from navigation state
  useEffect(() => {
    const navigationState = location.state;
    if (navigationState?.refreshQuotations && opportunityId) {
      // If we have a saved quotation from the navigation state, add it optimistically
      if (navigationState.savedQuotation) {
        setQuotations(prev => {
          const existing = prev.find(q => q.id === navigationState.savedQuotation.id);
          if (existing) {
            // Update existing quotation
            return prev.map(q => q.id === navigationState.savedQuotation.id ? navigationState.savedQuotation : q);
          } else {
            // Add new quotation
            return [navigationState.savedQuotation, ...prev];
          }
        });
      }
      
      // Also refresh the quotations list to ensure accuracy
      setTimeout(() => {
        loadQuotations();
      }, 100);
      
      // Clear the navigation state
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.state, opportunityId]);

  // Update stage from URL changes and check access
  useEffect(() => {
    const newStage = getInitialStage();
    setCurrentStage(newStage);
    
    // Check stage access when stage changes
    if (newStage === 'L5' && opportunityId) {
      checkStageAccess('L5');
    }
  }, [location.search, opportunityId]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !isViewMode) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isViewMode]);

  const loadOpportunity = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        const oppData = response.data.data;
        setOpportunity(oppData);
        
        // Load existing stage form data exactly as the existing modal does
        const existingFormData = oppData.stage_form_data || {};
        console.log('Loading opportunity with stage form data:', existingFormData);
        
        setStageFormData(existingFormData);
        calculateStageStatuses(existingFormData);
        
        // Set current stage based on opportunity's current stage
        const oppStage = oppData.stageId || oppData.current_stage_code || 'L1';
        setCurrentStage(oppStage);
      }
    } catch (error) {
      console.error('Error loading opportunity:', error);
      toast.error('Failed to load opportunity data');
    } finally {
      setLoading(false);
    }
  };

  // Load quotations for L4 display
  const loadQuotations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}/quotations`, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        setQuotations(response.data.data);
      }
    } catch (error) {
      console.error('Error loading quotations:', error);
      setQuotations([]);
    }
  };

  // Load current user information
  const loadCurrentUser = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        setCurrentUser(response.data.data);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
      setCurrentUser(null);
    }
  };

  // Load user permissions for role-based visibility
  const loadUserPermissions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/permissions/internal-costs`, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        setUserPermissions(response.data.data);
      }
    } catch (error) {
      console.error('Error loading user permissions:', error);
      setUserPermissions({});
    }
  };

  // Check if current user can access role-gated fields
  const canAccessRoleGatedField = () => {
    const userRole = currentUser?.role?.name || currentUser?.role || currentUser?.role_name;
    const allowedRoles = ['Admin', 'Commercial Approver', 'Sales Manager'];
    return allowedRoles.includes(userRole);
  };

  // Check stage access (especially for L5 gating)
  const checkStageAccess = async (stageId) => {
    if (!opportunityId) return true;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}/stage-access/${stageId}`, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        setStageAccess(prev => ({
          ...prev,
          [stageId]: response.data.data
        }));
        return response.data.data.access_granted;
      }
    } catch (error) {
      console.error(`Error checking access for stage ${stageId}:`, error);
      return true; // Default to allowing access if check fails
    }
    return true;
  };

  // Approve quotation
  const approveQuotation = async (quotationId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/quotations/${quotationId}/approve`, {}, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        toast.success('Quotation approved successfully');
        loadQuotations(); // Refresh quotations list
      }
    } catch (error) {
      console.error('Error approving quotation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to approve quotation';
      toast.error(errorMessage);
    }
  };

  // Delete quotation
  const deleteQuotation = async (quotationId) => {
    if (!window.confirm('Are you sure you want to delete this quotation?')) return;
    
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        toast.success('Quotation deleted successfully');
        loadQuotations(); // Refresh quotations list
      }
    } catch (error) {
      console.error('Error deleting quotation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to delete quotation';
      toast.error(errorMessage);
    }
  };

  const loadMasterData = async () => {
    try {
      // Suppress certificate authority warnings for analytics
      const originalError = console.error;
      console.error = (...args) => {
        if (args[0]?.includes?.('ERR_CERT_AUTHORITY_INVALID') || 
            args[0]?.includes?.('posthog')) {
          return; // Suppress analytics-related errors
        }
        originalError.apply(console, args);
      };

      const [companiesRes, usersRes, currenciesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/companies`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/api/master/currencies`, { headers: getAuthHeaders() })
      ]);

      setMasterData({
        regions: [
          { id: 'APAC', name: 'Asia Pacific' },
          { id: 'EMEA', name: 'Europe, Middle East & Africa' },
          { id: 'AMERICAS', name: 'Americas' },
          { id: 'INDIA', name: 'India' }
        ],
        products: [
          { id: 'software', name: 'Software Solutions' },
          { id: 'hardware', name: 'Hardware Infrastructure' },
          { id: 'services', name: 'Professional Services' },
          { id: 'support', name: 'Support & Maintenance' },
          { id: 'cloud', name: 'Cloud Services' },
          { id: 'security', name: 'Security Solutions' }
        ],
        users: usersRes.data.success ? usersRes.data.data.map(user => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          ...user
        })) : [],
        currencies: currenciesRes.data.success ? currenciesRes.data.data : [
          { currency_code: 'INR', currency_name: 'Indian Rupee', currency_symbol: '₹' },
          { currency_code: 'USD', currency_name: 'US Dollar', currency_symbol: '$' }
        ]
      });

      // Restore original console.error
      console.error = originalError;

      console.log('Master data loaded:', masterData);
    } catch (error) {
      console.error('Error loading master data:', error);
      // Set defaults if API calls fail
      setMasterData({
        regions: [
          { id: 'APAC', name: 'Asia Pacific' },
          { id: 'EMEA', name: 'Europe, Middle East & Africa' },
          { id: 'AMERICAS', name: 'Americas' },
          { id: 'INDIA', name: 'India' }
        ],
        products: [
          { id: 'software', name: 'Software Solutions' },
          { id: 'hardware', name: 'Hardware Infrastructure' },
          { id: 'services', name: 'Professional Services' },
          { id: 'support', name: 'Support & Maintenance' },
          { id: 'cloud', name: 'Cloud Services' },
          { id: 'security', name: 'Security Solutions' }
        ],
        users: [{ id: 'user1', name: 'Default User' }],
        currencies: [
          { currency_code: 'INR', currency_name: 'Indian Rupee', currency_symbol: '₹' },
          { currency_code: 'USD', currency_name: 'US Dollar', currency_symbol: '$' }
        ]
      });
    }
  };

  const calculateStageStatuses = (formData) => {
    const statuses = {};
    Object.keys(stageConfig).forEach(stage => {
      const stageFields = getStageFormFields(stage);
      const stageData = formData[stage] || {};
      
      const requiredFields = stageFields.filter(field => field.required);
      const filledRequiredFields = requiredFields.filter(field => 
        stageData[field.name] && stageData[field.name] !== ''
      );

      if (filledRequiredFields.length === 0) {
        statuses[stage] = 'not_started';
      } else if (filledRequiredFields.length < requiredFields.length) {
        statuses[stage] = 'in_progress';
      } else {
        statuses[stage] = 'completed';
      }
    });
    
    setStageStatuses(statuses);
  };

  const handleFieldChange = (fieldName, value) => {
    setStageFormData(prev => ({
      ...prev,
      [currentStage]: {
        ...prev[currentStage],
        [fieldName]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  // Complete final stage (L6/L7/L8) with opportunity status update
  const completeFinalStage = async () => {
    const confirmMessage = `Are you sure you want to complete this final stage? This action is irreversible and will update the opportunity status.`;
    if (!window.confirm(confirmMessage)) return;

    try {  
      setSaving(true);

      // First save the current stage data
      await saveStageData(false);

      // Determine the final opportunity status based on current stage
      let finalStatus;
      switch (currentStage) {
        case 'L6':
          finalStatus = 'Won';
          break;
        case 'L7':
          finalStatus = 'Lost';
          break;
        case 'L8':
          finalStatus = 'Dropped';
          break;
        default:
          finalStatus = 'Closed';
      }

      // Update opportunity status
      const response = await axios.put(`${API_BASE_URL}/api/opportunities/${opportunityId}/stage`, {
        stage_id: currentStage,
        form_data: {
          ...stageFormData,
          final_status: finalStatus,
          completion_date: new Date().toISOString()
        }
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success(`Opportunity marked as ${finalStatus} successfully`);
        
        // Redirect to opportunities list with live refresh
        navigate('/enhanced-opportunities', { replace: true });
        
        // Trigger a page reload to refresh pipeline and KPIs (temporary solution)
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
      console.error('Error completing final stage:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message;
      toast.error(`Failed to complete final stage: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Use the exact same API call as the existing modal
  const saveStageData = async (continueToNext = false) => {
    try {
      setSaving(true);
      
      let targetStage = currentStage;
      
      // Handle L5 commercial decision logic
      if (currentStage === 'L5' && continueToNext) {
        const commercialDecision = stageFormData[currentStage]?.commercial_decision;
        if (commercialDecision === 'Won') {
          targetStage = 'L6';
        } else if (commercialDecision === 'Reject') {
          targetStage = 'L7';
        } else {
          toast.error('Commercial Decision is required to proceed from L5');
          return;
        }
      } else if (continueToNext) {
        const nextStage = getNextStage();
        targetStage = nextStage || currentStage;
      }
      
      if (isCreateMode) {
        // For create mode, create the opportunity first with basic data, then save stage data
        const basicOpportunityData = {
          opportunity_title: stageFormData[currentStage]?.opportunity_title || 'New Opportunity',
          company_id: '1', // Default company for now
          opportunity_type: 'Software',
          opportunity_owner_id: masterData.users[0]?.id || '1',
          stage_form_data: stageFormData
        };

        console.log('Creating opportunity with data:', basicOpportunityData);

        const response = await axios.post(`${API_BASE_URL}/api/opportunities`, basicOpportunityData, {
          headers: getAuthHeaders()
        });
        
        if (response.data.success) {
          const newId = response.data.data.id;
          toast.success('Opportunity created successfully');
          
          if (continueToNext && targetStage !== currentStage) {
            navigate(`/opportunities/${newId}/edit?stage=${targetStage}`, { replace: true });
          } else {
            navigate(`/opportunities/${newId}/edit?stage=${currentStage}`, { replace: true });
          }
        }
      } else {
        // Use the exact same API call as the existing modal
        console.log('Saving stage data:', {
          stage_id: targetStage,
          form_data: stageFormData
        });

        const response = await axios.put(`${API_BASE_URL}/api/opportunities/${opportunityId}/stage`, {
          stage_id: targetStage,
          form_data: stageFormData
        }, {
          headers: getAuthHeaders()
        });
        
        if (response.data.success) {
          setHasUnsavedChanges(false);
          calculateStageStatuses(stageFormData);
          
          // Special message for L5 decision routing
          if (currentStage === 'L5' && continueToNext) {
            const decision = stageFormData[currentStage]?.commercial_decision;
            toast.success(`Commercial decision: ${decision}. Moved to ${targetStage === 'L6' ? 'Won' : 'Lost'} stage.`);
          } else {
            toast.success(continueToNext ? 'Saved and moved to next stage' : 'Stage data saved successfully');
          }
          
          if (continueToNext && targetStage !== currentStage) {
            setCurrentStage(targetStage);
            navigate(`/opportunities/${opportunityId}/edit?stage=${targetStage}`, { replace: true });
          }
        }
      }
    } catch (error) {
      console.error('Error saving stage data:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message;
      toast.error(`Failed to save stage data: ${errorMessage}`);
      
      // Display field-level validation errors if available
      if (error.response?.data?.validation_errors) {
        Object.entries(error.response.data.validation_errors).forEach(([field, message]) => {
          toast.error(`${field}: ${message}`);
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const navigateToStage = async (stage) => {
    // Check stage access (especially for L5)
    if (stage === 'L5') {
      const hasAccess = await checkStageAccess('L5');
      if (!hasAccess) {
        const accessInfo = stageAccess['L5'];
        if (accessInfo && accessInfo.guard_message) {
          toast.error(accessInfo.guard_message);
        } else {
          toast.error('L5 stage requires at least one approved quotation');
        }
        return;
      }
    }
    
    if (hasUnsavedChanges && !isViewMode) {
      if (window.confirm('You have unsaved changes. Do you want to save before switching stages?')) {
        saveStageData().then(() => {
          setCurrentStage(stage);
          updateUrlStage(stage);
        });
      } else {
        setCurrentStage(stage);
        updateUrlStage(stage);
        setHasUnsavedChanges(false);
      }
    } else {
      setCurrentStage(stage);
      updateUrlStage(stage);
    }
  };

  const updateUrlStage = (stage) => {
    const currentPath = location.pathname;
    const newUrl = `${currentPath}?stage=${stage}`;
    navigate(newUrl, { replace: true });
  };

  const getPreviousStage = () => {
    const stages = Object.keys(stageConfig);
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex > 0 ? stages[currentIndex - 1] : null;
  };

  const getNextStage = () => {
    const stages = Object.keys(stageConfig);
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const getStageStatusIcon = (stage) => {
    const status = stageStatuses[stage];
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStageStatusBadge = (stage) => {
    const status = stageStatuses[stage];
    const config = {
      completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800' },
      not_started: { label: 'Not Started', className: 'bg-gray-100 text-gray-600' }
    };
    
    const statusConfig = config[status] || config.not_started;
    return (
      <Badge className={`ml-2 ${statusConfig.className}`}>
        {statusConfig.label}
      </Badge>
    );
  };

  const renderField = (field) => {
    const currentStageData = stageFormData[currentStage] || {};
    const value = currentStageData[field.name] || field.defaultValue || '';

    // Hide admin-only fields for non-admin users
    if (field.adminOnly && !userPermissions.can_view_internal_costs) {
      return null;
    }

    // Hide role-gated fields for non-authorized users (commercial decision)
    if (field.roleGated && !canAccessRoleGatedField()) {
      return (
        <div className="p-3 bg-gray-100 border rounded-md">
          <span className="text-gray-500 italic">Restricted to Admin/Sales Manager/Commercial Approver only</span>
        </div>
      );
    }

    if (isViewMode || field.readOnly) {
      // Read-only display
      return (
        <div className="p-3 bg-gray-50 border rounded-md min-h-[40px]">
          {field.type === 'display' ? field.value : (value || <span className="text-gray-400 italic">Not provided</span>)}
        </div>
      );
    }

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            maxLength={field.maxLength}
            rows={3}
            className="w-full"
          />
        );
        
      case 'select':
        // Handle different types of option sources
        let options = [];
        
        if (Array.isArray(field.options)) {
          options = field.options;
        } else if (typeof field.options === 'string' && field.options.includes('masterData')) {
          // This won't work - we need to handle it differently
          options = [];
        } else {
          options = field.options || [];
        }

        // Special handling for dynamic options based on field name
        if (field.name === 'region') {
          options = masterData.regions || [];
        } else if (field.name === 'product_interest') {
          options = masterData.products || [];
        } else if (field.name === 'assigned_rep') {
          options = masterData.users || [];
        } else if (field.name === 'currency') {
          options = masterData.currencies?.map(c => ({ 
            id: c.currency_code, 
            name: `${c.currency_name} (${c.currency_symbol})` 
          })) || [
            { id: 'INR', name: 'Indian Rupee (₹)' },
            { id: 'USD', name: 'US Dollar ($)' }
          ];
        }

        console.log(`Rendering select for ${field.name} with options:`, options);

        return (
          <Select 
            value={value} 
            onValueChange={(val) => {
              console.log(`Setting ${field.name} to:`, val);
              handleFieldChange(field.name, val);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checklist':
        return (
          <div className="space-y-2">
            {field.items.map((item, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={currentStageData[`${field.name}_${index}`] || false}
                  onChange={(e) => handleFieldChange(`${field.name}_${index}`, e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">{item}</span>
              </label>
            ))}
          </div>
        );

      case 'multiselect':
        // Simplified multiselect for now
        return (
          <Select value={value} onValueChange={(val) => handleFieldChange(field.name, val)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-2">
                <label htmlFor={field.name} className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-500">Upload a file</span>
                  <input
                    id={field.name}
                    type="file"
                    className="sr-only"
                    accept={field.accept}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleFieldChange(field.name, file.name);
                      }
                    }}
                  />
                </label>
              </div>
              {value && <p className="text-sm text-gray-500 mt-1">{value}</p>}
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">{field.label}</span>
          </label>
        );

      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            className="w-full"
          />
        );
        
      case 'date':
        return (
          <Input
            id={field.name}
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="w-full"
          />
        );

      case 'display':
        return (
          <div className="p-2 bg-blue-50 border rounded-md">
            <span className="text-sm text-blue-800">{field.value}</span>
          </div>
        );

      case 'currency':
        return (
          <div className="flex items-center">
            <span className="text-gray-500 mr-2">$</span>
            <Input
              id={field.name}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              min={field.minValue || 0}
              step="0.01"
              className="w-full"
            />
          </div>
        );

      case 'button':
        return (
          <Button
            onClick={() => {
              if (field.action === 'triggerApproval') {
                toast.info('Commercial approval workflow triggered');
              } else if (field.action === 'reactivateOpportunity') {
                if (window.confirm('Are you sure you want to reactivate this opportunity?')) {
                  toast.success('Opportunity reactivated');
                }
              }
            }}
            className="w-full"
          >
            {field.label}
          </Button>
        );
        
      default:
        return (
          <Input
            id={field.name}
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            disabled={field.disabled}
            className="w-full"
          />
        );
    }
  };

  const canShowAddQuotation = () => {
    return ['L4', 'L5', 'L6'].includes(currentStage) && !isViewMode;
  };

  const handleAddQuotation = () => {
    if (!canShowAddQuotation()) return;
    
    const quotationUrl = `/quotation/new?opportunityId=${opportunityId}&stage=${currentStage}`;
    navigate(quotationUrl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading opportunity data...</p>
        </div>
      </div>
    );
  }

  const currentStageConfig = stageConfig[currentStage];
  const StageIcon = currentStageConfig?.icon || Target;
  const currentFields = getStageFormFields(currentStage);
  
  const getPageTitle = () => {
    if (isCreateMode) return 'Create New Opportunity';
    if (isViewMode) return 'View Opportunity Details';
    return 'Edit Opportunity - Manage Stages';
  };

  const getBreadcrumbPath = () => {
    if (isCreateMode) return 'Create Opportunity';
    if (isViewMode) return 'View Details';
    return 'Manage Stages';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Breadcrumbs */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/enhanced-opportunities')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </Button>
            <div className="text-sm text-gray-600">
              <span>Opportunities</span>
              <span className="mx-2">/</span>
              {isCreateMode ? (
                <span className="font-medium text-blue-600">Create New</span>
              ) : (
                <>
                  <span className="font-medium text-gray-900">
                    {opportunity?.opportunity_title || 'Loading...'}
                  </span>
                  <span className="mx-2">/</span>
                  <span className="font-medium text-blue-600">{getBreadcrumbPath()}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {hasUnsavedChanges && !isViewMode && (
              <div className="flex items-center text-yellow-600 text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                Unsaved changes
              </div>
            )}
            {isViewMode && (
              <Badge className="flex items-center">
                <Eye className="h-3 w-3 mr-1" />
                Read Only
              </Badge>
            )}
            {opportunityId && (
              <Badge variant="outline" className="text-xs">
                ID: {opportunityId}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stage Progress Stepper */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
          <div className="text-sm text-gray-600">
            {Object.values(stageStatuses).filter(status => status === 'completed').length} of {Object.keys(stageConfig).length} stages completed
          </div>
        </div>
        
        <div className="flex items-center space-x-1 overflow-x-auto pb-2">
          {Object.entries(stageConfig).map(([stage, config], index) => {
            const isActive = stage === currentStage;
            const isCompleted = stageStatuses[stage] === 'completed';
            const isInProgress = stageStatuses[stage] === 'in_progress';
            
            return (
              <React.Fragment key={stage}>
                <button
                  onClick={() => navigateToStage(stage)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                      : isCompleted
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : isInProgress
                      ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {getStageStatusIcon(stage)}
                  <span className="ml-2">{stage}</span>
                  <span className="ml-1 hidden sm:inline">- {config.name}</span>
                </button>
                
                {index < Object.keys(stageConfig).length - 1 && (
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card>
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <StageIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">{currentStage} - {currentStageConfig?.name}</CardTitle>
                  <p className="text-gray-600 mt-1">{currentStageConfig?.description}</p>
                </div>
              </div>
              {getStageStatusBadge(currentStage)}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Quotation Availability Notice */}
            {!canShowAddQuotation() && !isViewMode && ['L1', 'L2', 'L3'].includes(currentStage) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center text-blue-800">
                  <FileText className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Quotation management available from L4 onward</span>
                </div>
              </div>
            )}

            {/* L4 Quotation Management */}
            {currentStage === 'L4' && !isViewMode && (
              <div className="space-y-6">
                {/* Add Quotation Button */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-green-800">
                      <FileText className="h-4 w-4 mr-2" />
                      <span className="text-sm font-medium">Quotation Management Available</span>
                    </div>
                    <Button
                      onClick={handleAddQuotation}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Quotation
                    </Button>
                  </div>
                </div>

                {/* Existing Quotations */}
                {quotations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Existing Quotations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {quotations.map((quotation) => (
                          <div key={quotation.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div>
                                  <div className="font-medium text-gray-900">{quotation.quotation_number}</div>
                                  <div className="text-sm text-gray-500">
                                    Created: {new Date(quotation.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <Badge 
                                  className={
                                    quotation.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                    quotation.status === 'Unapproved' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                                  }
                                >
                                  {quotation.status}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <div className="text-right text-sm">
                                  <div className="font-medium">OTP: ${(quotation.calculated_otp || quotation.total_otp || 0).toLocaleString()}</div>
                                  <div className="text-gray-500">Recurring: ${(quotation.calculated_recurring || quotation.total_year1 || 0).toLocaleString()}/mo</div>
                                  <div className="text-gray-500">Total Tenure: ${(quotation.calculated_tenure_recurring || quotation.total_recurring || 0).toLocaleString()}</div>
                                  <div className="font-medium text-blue-600">Grand Total: ${(quotation.calculated_grand_total || quotation.grand_total || 0).toLocaleString()}</div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate(`/quotation/${quotation.id}?opportunityId=${opportunityId}`)}
                                  >
                                    {quotation.status === 'Approved' ? 'View' : 'Edit'}
                                  </Button>
                                  
                                  {quotation.status === 'Unapproved' && userPermissions.can_approve && (
                                    <Button
                                      size="sm"
                                      onClick={() => approveQuotation(quotation.id)}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      Approve
                                    </Button>
                                  )}
                                  
                                  {['Draft', 'Unapproved'].includes(quotation.status) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => deleteQuotation(quotation.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* L5 Stage Gating Message */}
            {currentStage === 'L5' && stageAccess['L5'] && !stageAccess['L5'].access_granted && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center text-yellow-800">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">{stageAccess['L5'].guard_message}</span>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentFields.map((field) => (
                <div key={field.name} className={field.type === 'textarea' || field.type === 'checklist' || field.type === 'file' ? 'md:col-span-2' : ''}>
                  {field.type !== 'checkbox' && (
                    <Label htmlFor={field.name} className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && !isViewMode && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                  )}
                  <div className="mt-1">
                    {renderField(field)}
                  </div>
                  {field.maxLength && (
                    <div className="text-xs text-gray-500 mt-1">
                      {(stageFormData[currentStage]?.[field.name] || '').length} / {field.maxLength} characters
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            {!isViewMode && (
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  {getPreviousStage() && (
                    <Button
                      variant="outline"
                      onClick={() => navigateToStage(getPreviousStage())}
                      disabled={saving}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous ({getPreviousStage()})
                    </Button>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => saveStageData(false)}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>

                  {getNextStage() && (
                    <Button
                      onClick={() => saveStageData(true)}
                      disabled={saving}
                    >
                      Save & Continue ({getNextStage()})
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}

                  {['L6', 'L7', 'L8'].includes(currentStage) && (
                    <Button
                      onClick={() => completeFinalStage()}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Final Stage
                    </Button>
                  )}

                  {currentStage === 'L5' && stageFormData[currentStage]?.commercial_decision && (
                    <Button
                      onClick={() => saveStageData(true)}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Save & Continue to {stageFormData[currentStage]?.commercial_decision === 'Won' ? 'Won (L6)' : stageFormData[currentStage]?.commercial_decision === 'Reject' ? 'Lost (L7)' : 'Next Stage'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OpportunityManagement;