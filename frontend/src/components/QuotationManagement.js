import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Save,
  Send,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Calculator,
  Trash2,
  DollarSign,
  Package,
  Layers,
  FileText
} from 'lucide-react';
import axios from 'axios';

const QuotationManagement = () => {
  const navigate = useNavigate();
  const { quotationId } = useParams();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');
  
  // Core state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState(null);
  const [isEditMode, setIsEditMode] = useState(true);
  
  // Form data state
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

  // Hierarchical data state with enhanced fields
  const [phases, setPhases] = useState([]);
  const [expandedPhases, setExpandedPhases] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // Master data state
  const [productCatalog, setProductCatalog] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [selectedRateCardId, setSelectedRateCardId] = useState('');
  
  // UI state
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedGroupForProduct, setSelectedGroupForProduct] = useState(null);
  
  // Calculated totals state with enhanced structure
  const [totals, setTotals] = useState({
    quotation_otp: 0,
    quotation_recurring_monthly: 0,
    quotation_recurring_total_tenure: 0,
    grand_total: 0
  });

  // API configuration
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

  // Helper function to get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Simple debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Enhanced calculation engine
  const calculateTotals = useCallback((phasesData) => {
    let quotation_otp = 0;
    let quotation_recurring_monthly = 0;
    let quotation_recurring_total_tenure = 0;

    // Calculate totals for each phase
    const calculatedPhases = phasesData.map(phase => {
      let phase_otp = 0;
      let phase_recurring_monthly = 0;
      
      // Calculate group totals
      const calculatedGroups = (phase.groups || []).map(group => {
        let group_otp = 0;
        let group_recurring_monthly = 0;
        
        const group_qty = parseFloat(group.quantity || 1);
        
        // Calculate item totals
        const calculatedItems = (group.items || []).map(item => {
          const item_qty = parseFloat(item.quantity || 0);
          const hrs_units = parseFloat(item.hrs_units || 1);
          const base_multiplier = group_qty * item_qty * hrs_units;
          
          // OTP calculations
          const one_time_price = parseFloat(item.one_time_price || 0);
          const otp_discount_pct = parseFloat(item.otp_discount_percentage || 0);
          const discounted_otp = (one_time_price * (1 - otp_discount_pct / 100)) * base_multiplier;
          const total_otp = discounted_otp;
          
          // Recurring calculations
          const recurring_price = parseFloat(item.recurring_price_monthly || 0);
          const recurring_discount_pct = parseFloat(item.recurring_discount_percentage || 0);
          const discounted_recurring_monthly = (recurring_price * (1 - recurring_discount_pct / 100)) * base_multiplier;
          const total_recurring_monthly = discounted_recurring_monthly;
          const total_recurring_tenure = total_recurring_monthly * parseFloat(phase.tenure_months || 12);
          
          // Add to group totals
          group_otp += total_otp;
          group_recurring_monthly += total_recurring_monthly;
          
          return {
            ...item,
            discounted_otp,
            total_otp,
            discounted_recurring_monthly,
            total_recurring_monthly,
            total_recurring_tenure
          };
        });
        
        // Calculate group recurring tenure
        const group_recurring_tenure = group_recurring_monthly * parseFloat(phase.tenure_months || 12);
        
        // Add to phase totals
        phase_otp += group_otp;
        phase_recurring_monthly += group_recurring_monthly;
        
        return {
          ...group,
          group_otp,
          group_recurring_monthly,
          group_recurring_tenure,
          items: calculatedItems
        };
      });
      
      // Calculate phase recurring tenure
      const phase_recurring_tenure = phase_recurring_monthly * parseFloat(phase.tenure_months || 12);
      
      // Add to quotation totals
      quotation_otp += phase_otp;
      quotation_recurring_monthly += phase_recurring_monthly;
      quotation_recurring_total_tenure += phase_recurring_tenure;
      
      return {
        ...phase,
        phase_otp,
        phase_recurring_monthly,
        phase_recurring_tenure,
        groups: calculatedGroups
      };
    });

    // Update phases state with calculated values
    setPhases(calculatedPhases);

    // Grand total = OTP + Total tenure recurring
    const grand_total = quotation_otp + quotation_recurring_total_tenure;

    setTotals({
      quotation_otp,
      quotation_recurring_monthly,
      quotation_recurring_total_tenure,
      grand_total
    });
  }, []);

  // Debounced recalculation
  const debouncedRecalculate = useCallback(
    debounce((phasesData) => {
      calculateTotals(phasesData);
    }, 300),
    [calculateTotals]
  );

  // Initialize component
  useEffect(() => {
    if (quotationId) {
      loadQuotation();
    } else if (opportunityId) {
      initializeNewQuotation();
    }
    loadMasterData();
  }, [quotationId, opportunityId]);

  // Load existing quotation
  const loadQuotation = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/quotations/${quotationId}`, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        const quotationData = response.data.data;
        setQuotation(quotationData);
        setQuotationFormData(quotationData);
        
        // Ensure phases have all required fields
        const enhancedPhases = (quotationData.phases || []).map(phase => ({
          ...phase,
          start_date: phase.start_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tenure_months: phase.tenure_months || 12,
          escalation_percentage: phase.escalation_percentage || 0,
          phase_otp: phase.phase_otp || 0,
          phase_recurring_monthly: phase.phase_recurring_monthly || 0,
          phase_recurring_tenure: phase.phase_recurring_tenure || 0,
          groups: (phase.groups || []).map(group => ({
            ...group,
            quantity: group.quantity || 1,
            group_otp: group.group_otp || 0,
            group_recurring_monthly: group.group_recurring_monthly || 0,
            group_recurring_tenure: group.group_recurring_tenure || 0,
            items: (group.items || []).map(item => ({
              ...item,
              quantity: item.quantity || 1,
              hrs_units: item.hrs_units || 1,
              one_time_price: item.one_time_price || 0,
              otp_discount_percentage: item.otp_discount_percentage || 0,
              recurring_price_monthly: item.recurring_price_monthly || 0,
              recurring_discount_percentage: item.recurring_discount_percentage || 0,
              location: item.location || '',
              stock_status: item.stock_status || 'In Stock',
              note: item.note || ''
            }))
          }))
        }));
        
        setPhases(enhancedPhases);
        setIsEditMode(quotationData.status !== 'approved');
        
        // Expand all phases and groups by default
        if (enhancedPhases.length > 0) {
          const phaseIds = new Set(enhancedPhases.map(p => p.id));
          const groupIds = new Set();
          enhancedPhases.forEach(phase => {
            if (phase.groups) {
              phase.groups.forEach(group => groupIds.add(group.id));
            }
          });
          setExpandedPhases(phaseIds);
          setExpandedGroups(groupIds);
        }
        
        // Calculate totals with enhanced phases
        calculateTotals(enhancedPhases);
      }
    } catch (error) {
      console.error('Error loading quotation:', error);
      toast.error('Failed to load quotation');
      navigate(opportunityId ? `/opportunities/${opportunityId}/edit?stage=L4` : '/enhanced-opportunities');
    } finally {
      setLoading(false);
    }
  };

  // Initialize new quotation
  const initializeNewQuotation = async () => {
    try {
      setLoading(true);
      
      // Generate quotation number
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const quotationNumber = `QUO-${timestamp}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      
      // Get opportunity details if available
      let customerName = '';
      if (opportunityId) {
        try {
          const oppResponse = await axios.get(`${API_BASE_URL}/api/opportunities/${opportunityId}`, {
            headers: getAuthHeaders()
          });
          if (oppResponse.data.success) {
            customerName = oppResponse.data.data.company_name || '';
          }
        } catch (err) {
          console.warn('Could not load opportunity details:', err);
        }
      }

      setQuotationFormData(prev => ({
        ...prev,
        quotation_number: quotationNumber,
        customer_name: customerName,
        validity_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
      }));

      // Initialize with one default phase with enhanced fields
      const defaultPhase = {
        id: `phase-${Date.now()}`,
        phase_name: 'Hardware',
        phase_description: '',
        phase_order: 1,
        start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
        tenure_months: 12,
        escalation_percentage: 0,
        phase_otp: 0,
        phase_recurring_monthly: 0,
        phase_recurring_tenure: 0,
        groups: []
      };
      
      setPhases([defaultPhase]);
      setExpandedPhases(new Set([defaultPhase.id]));
      
    } catch (error) {
      console.error('Error initializing quotation:', error);
      toast.error('Failed to initialize quotation');
    } finally {
      setLoading(false);
    }
  };

  // Load master data
  // Handle rate card change and recalculate all pricing
  const handleRateCardChange = async (newRateCardId) => {
    try {
      setLoading(true);
      
      // Recalculate pricing for all items across all phases and groups
      const updatedPhases = await Promise.all(
        phases.map(async (phase) => {
          const phaseStartDate = phase.start_date || new Date().toISOString().split('T')[0];
          
          const updatedGroups = await Promise.all(
            (phase.groups || []).map(async (group) => {
              const updatedItems = await Promise.all(
                (group.items || []).map(async (item) => {
                  try {
                    const response = await axios.get(
                      `${API_BASE_URL}/api/products/${item.core_product_id}/pricing?asOf=${phaseStartDate}&rateCardId=${newRateCardId}`,
                      { headers: getAuthHeaders() }
                    );

                    if (response.data.success && response.data.data) {
                      const pricingData = response.data.data;
                      const updatedItem = {
                        ...item,
                        one_time_price: pricingData.otp_price || 0,
                        recurring_price_monthly: pricingData.recurring_price || 0,
                        price_list_id: newRateCardId,
                        pricing_snapshot: pricingData,
                        price_warning: null
                      };
                      
                      // Set warning if no pricing found
                      if (pricingData.otp_price === 0 && pricingData.recurring_price === 0) {
                        updatedItem.price_warning = `No pricing available for this product in the selected rate card.`;
                      }
                      
                      return updatedItem;
                    }
                    return {
                      ...item,
                      price_warning: `Failed to fetch pricing for selected rate card`
                    };
                  } catch (error) {
                    console.error(`Error fetching pricing for item ${item.product_name}:`, error);
                    return {
                      ...item,
                      price_warning: `Error fetching pricing for selected rate card`
                    };
                  }
                })
              );
              return { ...group, items: updatedItems };
            })
          );
          return { ...phase, groups: updatedGroups };
        })
      );
      
      // Update state with new pricing and recalculate totals
      setPhases(recalculateAllTotals(updatedPhases));
      toast.success('All item prices updated with new rate card');
      
    } catch (error) {
      console.error('Error during rate card change:', error);
      toast.error('Failed to update prices with new rate card');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const [productsRes, rateCardsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/products/catalog`, { headers: getAuthHeaders() }),
        axios.get(`${API_BASE_URL}/api/pricing-lists`, { headers: getAuthHeaders() })
      ]);

      if (productsRes.data.success) {
        setProductCatalog(productsRes.data.data);
      }

      if (rateCardsRes.data.success) {
        const today = new Date().toISOString().split('T')[0];
        // Filter active rate cards that are valid for today
        const activeRateCards = rateCardsRes.data.data.filter(card => 
          card.is_active && 
          card.effective_date <= today &&
          (!card.expiry_date || card.expiry_date >= today)
        );
        setRateCards(activeRateCards);
        
        // Set default rate card if available
        const defaultCard = activeRateCards.find(card => card.is_default);
        if (defaultCard) {
          setSelectedRateCardId(defaultCard.id);
          setQuotationFormData(prev => ({ ...prev, pricing_list_id: defaultCard.id }));
        }
      }
    } catch (error) {
      console.error('Error loading master data:', error);
      toast.error('Failed to load master data');
    }
  };

  // Save quotation with validation and enhanced data structure
  const saveQuotation = async (isSubmit = false) => {
    try {
      setSaving(true);
      
      // Validation for submit
      if (isSubmit) {
        // Validate future start dates
        const today = new Date().toISOString().split('T')[0];
        for (const phase of phases) {
          if (!phase.start_date || phase.start_date <= today) {
            toast.error(`Phase "${phase.phase_name}" must have a future start date`);
            return;
          }
          if (!phase.tenure_months || phase.tenure_months <= 0) {
            toast.error(`Phase "${phase.phase_name}" must have a positive tenure in months`);
            return;
          }
        }
      }
      
      // Prepare quotation data with complete hierarchy
      const quotationData = {
        ...quotationFormData,
        opportunity_id: opportunityId,
        customer_id: opportunityId, // Simplified - in real app would be separate
        phases: phases.map(phase => ({
          ...phase,
          groups: (phase.groups || []).map(group => ({
            ...group,
            items: (group.items || []).map(item => ({
              ...item
            }))
          }))
        })),
        // Use new status flow: Draft -> Unapproved -> Approved
        status: isSubmit ? 'Unapproved' : 'Draft',
        // Include calculated totals
        total_otp: totals.quotation_otp,
        total_recurring: totals.quotation_recurring_total_tenure,
        grand_total: totals.grand_total,
        // Map to backend expected fields
        quotation_otp: totals.quotation_otp,
        quotation_recurring_monthly: totals.quotation_recurring_monthly,
        quotation_recurring_total_tenure: totals.quotation_recurring_total_tenure
      };

      let response;
      if (quotationId) {
        response = await axios.put(`${API_BASE_URL}/api/quotations/${quotationId}`, quotationData, {
          headers: getAuthHeaders()
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/quotations`, quotationData, {
          headers: getAuthHeaders()
        });
      }

      if (response.data.success) {
        const statusMessage = isSubmit ? 'Quotation submitted for approval' : 'Quotation saved as draft';
        toast.success(statusMessage);
        
        // Create quotation data for optimistic update with correct totals
        const savedQuotationData = {
          id: response.data.data.id || quotationId,
          quotation_number: response.data.data.quotation_number || quotationFormData.quotation_number,
          status: isSubmit ? 'Unapproved' : 'Draft',
          created_at: response.data.data.created_at || new Date().toISOString(),
          calculated_otp: totals.quotation_otp,
          calculated_recurring: totals.quotation_recurring_monthly,
          calculated_tenure_recurring: totals.quotation_recurring_total_tenure,
          calculated_grand_total: totals.grand_total,
          opportunity_id: opportunityId
        };
        
        // Navigate to L4 with the quotation data for immediate display
        navigate(`/opportunities/${opportunityId}/edit?stage=L4`, { 
          replace: true,
          state: { 
            savedQuotation: savedQuotationData,
            refreshQuotations: true 
          }
        });
      }
    } catch (error) {
      console.error('Error saving quotation:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save quotation';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Phase management with enhanced fields
  const addPhase = () => {
    const newPhase = {
      id: `phase-${Date.now()}`,
      phase_name: `Phase ${phases.length + 1}`,
      phase_description: '',
      phase_order: phases.length + 1,
      start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      tenure_months: 12,
      escalation_percentage: 0,
      phase_otp: 0,
      phase_recurring_monthly: 0,
      phase_recurring_tenure: 0,
      groups: []
    };
    
    setPhases(prev => [...prev, newPhase]);
    setExpandedPhases(prev => new Set([...prev, newPhase.id]));
  };

  const updatePhase = (phaseId, updates) => {
    setPhases(prev => {
      const updated = prev.map(phase => 
        phase.id === phaseId ? { ...phase, ...updates } : phase
      );
      // Trigger recalculation if tenure changes
      if (updates.tenure_months !== undefined) {
        debouncedRecalculate(updated);
      }
      return updated;
    });
  };

  const deletePhase = (phaseId) => {
    setPhases(prev => {
      const updated = prev.filter(phase => phase.id !== phaseId);
      debouncedRecalculate(updated);
      return updated;
    });
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      newSet.delete(phaseId);
      return newSet;
    });
  };

  // Group management with enhanced fields
  const addGroup = (phaseId) => {
    const newGroup = {
      id: `group-${Date.now()}`,
      group_name: 'New Group',
      group_description: '',
      group_order: 1,
      quantity: 1,
      group_otp: 0,
      group_recurring_monthly: 0,
      group_recurring_tenure: 0,
      items: []
    };

    setPhases(prev => prev.map(phase => {
      if (phase.id === phaseId) {
        return {
          ...phase,
          groups: [...(phase.groups || []), newGroup]
        };
      }
      return phase;
    }));
    
    setExpandedGroups(prev => new Set([...prev, newGroup.id]));
  };

  const updateGroup = (phaseId, groupId, updates) => {
    setPhases(prev => {
      const updated = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            groups: (phase.groups || []).map(group =>
              group.id === groupId ? { ...group, ...updates } : group
            )
          };
        }
        return phase;
      });
      // Trigger recalculation if quantity changes
      if (updates.quantity !== undefined) {
        debouncedRecalculate(updated);
      }
      return updated;
    });
  };

  const deleteGroup = (phaseId, groupId) => {
    setPhases(prev => {
      const updated = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            groups: (phase.groups || []).filter(group => group.id !== groupId)
          };
        }
        return phase;
      });
      debouncedRecalculate(updated);
      return updated;
    });
    
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      return newSet;
    });
  };

  // Item management with enhanced fields
  const addItemToGroup = async (phaseId, groupId, productData) => {
    const newItem = {
      id: `item-${Date.now()}`,
      core_product_id: productData.id,
      product_name: productData.core_product_name,
      sku_code: productData.skucode,
      quantity: 1,
      hrs_units: 1,
      one_time_price: 0,
      otp_discount_percentage: 0,
      discounted_otp: 0,
      total_otp: 0,
      recurring_price_monthly: 0,
      recurring_discount_percentage: 0,
      discounted_recurring_monthly: 0,
      total_recurring_monthly: 0,
      total_recurring_tenure: 0,
      location: '',
      stock_status: 'In Stock',
      note: '',
      item_order: ((phases.find(p => p.id === phaseId)?.groups?.find(g => g.id === groupId)?.items?.length || 0) + 1),
      price_warning: null, // Track pricing warnings
      price_list_id: null, // Track which price list was used
      pricing_snapshot: null // Store snapshotted pricing data
    };

    // Fetch pricing for the selected product
    try {
      const phase = phases.find(p => p.id === phaseId);
      const phaseStartDate = phase?.start_date || new Date().toISOString().split('T')[0];
      
      const response = await axios.get(
        `${API_BASE_URL}/api/products/${productData.id}/pricing?asOf=${phaseStartDate}${selectedRateCardId ? `&rateCardId=${selectedRateCardId}` : ''}`,
        { 
          headers: getAuthHeaders()
        }
      );

      if (response.data.success && response.data.data) {
        const pricingData = response.data.data;
        newItem.one_time_price = pricingData.otp_price || 0;
        newItem.recurring_price_monthly = pricingData.recurring_price || 0;
        newItem.price_list_id = pricingData.price_list_id;
        newItem.pricing_snapshot = pricingData;
        
        if (pricingData.otp_price === 0 && pricingData.recurring_price === 0) {
          newItem.price_warning = "No pricing available for this product and date. Please configure pricing in Master Data.";
        } else if (pricingData.otp_price === 0) {
          newItem.price_warning = "No one-time price available. Only recurring price found.";
        } else if (pricingData.recurring_price === 0) {
          newItem.price_warning = "No recurring price available. Only one-time price found.";
        }
      } else {
        newItem.price_warning = "Failed to fetch pricing. Please configure pricing in Master Data.";
      }
    } catch (error) {
      console.error('Error fetching product pricing:', error);
      newItem.price_warning = "Error fetching pricing from server. Please check Master Data configuration.";
    }

    setPhases(prev => {
      const updated = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            groups: (phase.groups || []).map(group => {
              if (group.id === groupId) {
                return {
                  ...group,
                  items: [...(group.items || []), newItem]
                };
              }
              return group;
            })
          };
        }
        return phase;
      });
      // Trigger recalculation with updated phases
      setTimeout(() => calculateTotals(updated), 0);
      return updated;
    });

    // Show pricing status message
    if (newItem.price_warning) {
      toast.warning(newItem.price_warning);
    } else {
      toast.success(`Product pricing loaded: OTP $${newItem.one_time_price}, Recurring $${newItem.recurring_price_monthly}/month`);
    }
  };

  // Update item function
  const updateItem = (phaseId, groupId, itemId, updates) => {
    setPhases(prev => {
      const updated = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            groups: (phase.groups || []).map(group => {
              if (group.id === groupId) {
                return {
                  ...group,
                  items: (group.items || []).map(item =>
                    item.id === itemId ? { ...item, ...updates } : item
                  )
                };
              }
              return group;
            })
          };
        }
        return phase;
      });
      // Trigger debounced recalculation
      debouncedRecalculate(updated);
      return updated;
    });
  };

  // Delete item function
  const deleteItem = (phaseId, groupId, itemId) => {
    setPhases(prev => {
      const updated = prev.map(phase => {
        if (phase.id === phaseId) {
          return {
            ...phase,
            groups: (phase.groups || []).map(group => {
              if (group.id === groupId) {
                return {
                  ...group,
                  items: (group.items || []).filter(item => item.id !== itemId)
                };
              }
              return group;
            })
          };
        }
        return phase;
      });
      // Trigger recalculation with updated phases
      setTimeout(() => calculateTotals(updated), 0);
      return updated;
    });
  };

  // Toggle expansion states
  const togglePhaseExpansion = (phaseId) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Product search
  const openProductSearch = (phaseId, groupId) => {
    setSelectedGroupForProduct({ phaseId, groupId });
    setShowProductSearch(true);
    setProductSearchTerm('');
  };

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return productCatalog.slice(0, 50); // Show first 50 by default
    
    return productCatalog.filter(product =>
      product.core_product_name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      product.skucode.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      product.primary_category.toLowerCase().includes(productSearchTerm.toLowerCase())
    ).slice(0, 50);
  }, [productCatalog, productSearchTerm]);

  // Handle form changes
  const handleFormChange = (field, value) => {
    setQuotationFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quotation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/opportunities/${opportunityId}/edit?stage=L4`)}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Opportunities
              </Button>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {quotationId ? 'Edit Quotation' : 'New Quotation'}
                </h1>
                <p className="text-sm text-gray-500">
                  {quotationFormData.quotation_number || 'Draft'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={async () => {
                  setLoading(true);
                  toast.info('Recalculating with fresh master data prices...');
                  
                  try {
                    // Refetch pricing for all items
                    const updatedPhases = await Promise.all(
                      phases.map(async (phase) => {
                        const phaseStartDate = phase.start_date || new Date().toISOString().split('T')[0];
                        
                        const updatedGroups = await Promise.all(
                          (phase.groups || []).map(async (group) => {
                            const updatedItems = await Promise.all(
                              (group.items || []).map(async (item) => {
                                try {
                                  const response = await axios.get(
                                    `${API_BASE_URL}/api/products/${item.core_product_id}/pricing?asOf=${phaseStartDate}${selectedRateCardId ? `&rateCardId=${selectedRateCardId}` : ''}`,
                                    { headers: getAuthHeaders() }
                                  );

                                  if (response.data.success && response.data.data) {
                                    const pricingData = response.data.data;
                                    const updatedItem = {
                                      ...item,
                                      one_time_price: pricingData.otp_price || 0,
                                      recurring_price_monthly: pricingData.recurring_price || 0,
                                      price_list_id: pricingData.price_list_id,
                                      pricing_snapshot: pricingData,
                                      price_warning: null
                                    };
                                    
                                    // Set warning if no pricing found
                                    if (pricingData.otp_price === 0 && pricingData.recurring_price === 0) {
                                      updatedItem.price_warning = "No pricing available for this product and date.";
                                    }
                                    
                                    return updatedItem;
                                  }
                                  return item;
                                } catch (error) {
                                  console.error(`Error fetching pricing for item ${item.product_name}:`, error);
                                  return {
                                    ...item,
                                    price_warning: "Error fetching updated pricing"
                                  };
                                }
                              })
                            );
                            return { ...group, items: updatedItems };
                          })
                        );
                        return { ...phase, groups: updatedGroups };
                      })
                    );
                    
                    // Update state with new pricing and recalculate totals
                    setPhases(recalculateAllTotals(updatedPhases));
                    toast.success('Prices updated from master data and totals recalculated');
                    
                  } catch (error) {
                    console.error('Error during recalculation:', error);
                    toast.error('Failed to update prices. Using existing values for calculation.');
                    // Fallback to normal recalculation
                    calculateTotals([...phases]);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={saving || loading}
              >
                <Calculator className="h-4 w-4 mr-2" />
                Recalculate
              </Button>
              
              <Button
                variant="outline"
                onClick={() => saveQuotation(false)}
                disabled={saving || !isEditMode}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              
              <Button
                onClick={() => saveQuotation(true)}
                disabled={saving || !isEditMode}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {saving ? 'Submitting...' : 'Save & Submit'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="xl:col-span-3 space-y-6">
            {/* Quotation Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Quotation Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="quotation_number">Quotation Number</Label>
                    <Input
                      id="quotation_number"
                      value={quotationFormData.quotation_number}
                      onChange={(e) => handleFormChange('quotation_number', e.target.value)}
                      disabled={!isEditMode}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      value={quotationFormData.customer_name}
                      onChange={(e) => handleFormChange('customer_name', e.target.value)}
                      disabled={!isEditMode}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <Label htmlFor="rate_card" className="flex items-center text-blue-800 font-medium">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Rate Card Selection
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <p className="text-sm text-blue-700 mb-3">Select the rate card to use for pricing this quotation. Changing this will recalculate all item prices.</p>
                      <Select
                        value={selectedRateCardId}
                        onValueChange={async (value) => {
                          setSelectedRateCardId(value);
                          setQuotationFormData(prev => ({ ...prev, pricing_list_id: value }));
                          
                          // Recalculate all item prices with new rate card
                          if (isEditMode && phases.length > 0) {
                            toast.info('Updating prices with selected rate card...');
                            // Trigger recalculation logic here
                            await handleRateCardChange(value);
                          }
                        }}
                        disabled={!isEditMode}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select a rate card" />
                        </SelectTrigger>
                        <SelectContent>
                          {rateCards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{card.name}</span>
                                {card.is_default && (
                                  <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedRateCardId && (
                        <div className="mt-2 text-xs text-blue-600">
                          Selected: {rateCards.find(c => c.id === selectedRateCardId)?.name}
                          {rateCards.find(c => c.id === selectedRateCardId)?.description && (
                            <span className="ml-2 text-gray-600">
                              - {rateCards.find(c => c.id === selectedRateCardId)?.description}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="customer_contact_email">Contact Email</Label>
                    <Input
                      id="customer_contact_email"
                      type="email"
                      value={quotationFormData.customer_contact_email}
                      onChange={(e) => handleFormChange('customer_contact_email', e.target.value)}
                      disabled={!isEditMode}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="validity_date">Valid Until</Label>
                    <Input
                      id="validity_date"
                      type="date"
                      value={quotationFormData.validity_date}
                      onChange={(e) => handleFormChange('validity_date', e.target.value)}
                      disabled={!isEditMode}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="terms_and_conditions">Terms & Conditions</Label>
                    <Textarea
                      id="terms_and_conditions"
                      value={quotationFormData.terms_and_conditions}
                      onChange={(e) => handleFormChange('terms_and_conditions', e.target.value)}
                      disabled={!isEditMode}
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Hierarchy */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <Layers className="h-5 w-5 mr-2 text-blue-600" />
                      Quotation Items
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Organize your quotation into phases, groups, and individual items
                    </p>
                  </div>
                  
                  {isEditMode && (
                    <Button
                      onClick={addPhase}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Phase
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {phases.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No phases added yet</p>
                    {isEditMode && (
                      <Button onClick={addPhase} className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Phase
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {phases.map((phase) => (
                      <div key={phase.id} className="border border-gray-200 rounded-lg">
                        {/* Phase Header */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePhaseExpansion(phase.id)}
                                className="p-1"
                              >
                                {expandedPhases.has(phase.id) ? 
                                  <ChevronDown className="h-4 w-4" /> : 
                                  <ChevronRight className="h-4 w-4" />
                                }
                              </Button>
                              
                              <div className="flex-1">
                                {isEditMode ? (
                                  <Input
                                    value={phase.phase_name}
                                    onChange={(e) => updatePhase(phase.id, { phase_name: e.target.value })}
                                    className="font-medium"
                                    placeholder="Phase Name"
                                  />
                                ) : (
                                  <h3 className="font-medium text-gray-900">{phase.phase_name}</h3>
                                )}
                              </div>
                            </div>
                            
                            {isEditMode && (
                              <div className="flex items-center space-x-2">
                                <Button
                                  onClick={() => addGroup(phase.id)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add Group
                                </Button>
                                
                                <Button
                                  onClick={() => deletePhase(phase.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Phase Fields */}
                          {isEditMode && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <Label htmlFor={`phase-start-date-${phase.id}`}>Start Date</Label>
                                <Input
                                  id={`phase-start-date-${phase.id}`}
                                  type="date"
                                  value={phase.start_date || ''}
                                  onChange={(e) => updatePhase(phase.id, { start_date: e.target.value })}
                                  min={new Date().toISOString().split('T')[0]}
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor={`phase-tenure-${phase.id}`}>Tenure (Months)</Label>
                                <Input
                                  id={`phase-tenure-${phase.id}`}
                                  type="number"
                                  min="1"
                                  value={phase.tenure_months || 12}
                                  onChange={(e) => {
                                    updatePhase(phase.id, { tenure_months: parseInt(e.target.value) || 12 });
                                  }}
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor={`phase-escalation-${phase.id}`}>Escalation %</Label>
                                <Input
                                  id={`phase-escalation-${phase.id}`}
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={phase.escalation_percentage || 0}
                                  onChange={(e) => updatePhase(phase.id, { escalation_percentage: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                              
                              <div className="flex flex-col justify-center">
                                <div className="text-sm font-medium text-gray-700">Phase Totals</div>
                                <div className="text-xs text-gray-500">
                                  OTP: ${(phase.phase_otp || 0).toFixed(2)} | 
                                  Recurring: ${(phase.phase_recurring_monthly || 0).toFixed(2)}/mo
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Phase Content */}
                        {expandedPhases.has(phase.id) && (
                          <div className="p-4">
                            {/* Groups */}
                            {(!phase.groups || phase.groups.length === 0) ? (
                              <div className="text-center py-6 text-gray-400">
                                <p>No groups in this phase</p>
                                {isEditMode && (
                                  <Button
                                    onClick={() => addGroup(phase.id)}
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Group
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {phase.groups.map((group) => (
                                  <div key={group.id} className="border border-gray-100 rounded-md">
                                    {/* Group Header */}
                                    <div className="p-3 bg-gray-25 border-b border-gray-100">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleGroupExpansion(group.id)}
                                            className="p-1"
                                          >
                                            {expandedGroups.has(group.id) ? 
                                              <ChevronDown className="h-3 w-3" /> : 
                                              <ChevronRight className="h-3 w-3" />
                                            }
                                          </Button>
                                          
                                          {isEditMode ? (
                                            <Input
                                              value={group.group_name}
                                              onChange={(e) => updateGroup(phase.id, group.id, { group_name: e.target.value })}
                                              className="text-sm"
                                              placeholder="Group Name"
                                            />
                                          ) : (
                                            <span className="text-sm font-medium text-gray-700">{group.group_name}</span>
                                          )}
                                        </div>
                                        
                                        {isEditMode && (
                                          <div className="flex items-center space-x-1">
                                            <Button
                                              onClick={() => openProductSearch(phase.id, group.id)}
                                              size="sm"
                                              variant="outline"
                                            >
                                              <Plus className="h-3 w-3 mr-1" />
                                              Add Item
                                            </Button>
                                            
                                            <Button
                                              onClick={() => deleteGroup(phase.id, group.id)}
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-600 hover:text-red-700"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>

                                      {/* Group Fields */}
                                      {isEditMode && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <div>
                                            <Label htmlFor={`group-qty-${group.id}`}>Group Quantity</Label>
                                            <Input
                                              id={`group-qty-${group.id}`}
                                              type="number"
                                              min="1"
                                              value={group.quantity || 1}
                                              onChange={(e) => {
                                                updateGroup(phase.id, group.id, { quantity: parseInt(e.target.value) || 1 });
                                              }}
                                            />
                                          </div>
                                          
                                          <div className="flex flex-col justify-center">
                                            <div className="text-xs font-medium text-gray-600">Group OTP (read-only)</div>
                                            <div className="text-sm font-semibold text-blue-600">
                                              ${(group.group_otp || 0).toFixed(2)}
                                            </div>
                                          </div>
                                          
                                          <div className="flex flex-col justify-center">
                                            <div className="text-xs font-medium text-gray-600">Group Recurring/mo (read-only)</div>
                                            <div className="text-sm font-semibold text-green-600">
                                              ${(group.group_recurring_monthly || 0).toFixed(2)}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Group Items */}
                                    {expandedGroups.has(group.id) && (
                                      <div className="p-3">
                                        {(!group.items || group.items.length === 0) ? (
                                          <div className="text-center py-4 text-gray-400">
                                            <p className="text-sm">No items in this group</p>
                                            {isEditMode && (
                                              <Button
                                                onClick={() => openProductSearch(phase.id, group.id)}
                                                size="sm"
                                                variant="outline"
                                                className="mt-2"
                                              >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Add Item
                                              </Button>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            {group.items.map((item) => (
                                              <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                  <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900">
                                                      {item.product_name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                      SKU: {item.sku_code}
                                                    </div>
                                                    {item.price_warning && (
                                                      <div className="mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                                                        <div className="flex items-center text-xs text-yellow-800">
                                                          <svg className="w-3 h-3 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                          </svg>
                                                          <span className="font-medium">Pricing Issue:</span>
                                                        </div>
                                                        <div className="text-xs text-yellow-700 mt-1">
                                                          {item.price_warning}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  {isEditMode && (
                                                    <Button
                                                      onClick={() => deleteItem(phase.id, group.id, item.id)}
                                                      size="sm"
                                                      variant="ghost"
                                                      className="text-red-600 hover:text-red-700"
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                </div>

                                                {isEditMode ? (
                                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {/* Basic Item Fields */}
                                                    <div>
                                                      <Label>Quantity</Label>
                                                      <Input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity || 1}
                                                        onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                          quantity: parseInt(e.target.value) || 1 
                                                        })}
                                                      />
                                                    </div>
                                                    
                                                    <div>
                                                      <Label>Hrs/Units</Label>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={item.hrs_units || 1}
                                                        onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                          hrs_units: parseFloat(e.target.value) || 1 
                                                        })}
                                                      />
                                                    </div>
                                                    
                                                    <div>
                                                      <Label>Location</Label>
                                                      <Input
                                                        value={item.location || ''}
                                                        onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                          location: e.target.value 
                                                        })}
                                                        placeholder="Location"
                                                      />
                                                    </div>
                                                    
                                                    <div>
                                                      <Label>Stock Status</Label>
                                                      <Select
                                                        value={item.stock_status || 'In Stock'}
                                                        onValueChange={(value) => updateItem(phase.id, group.id, item.id, { 
                                                          stock_status: value 
                                                        })}
                                                      >
                                                        <SelectTrigger>
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="In Stock">In Stock</SelectItem>
                                                          <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                    </div>
                                                    
                                                    {/* One-Time Pricing Section */}
                                                    <div className="md:col-span-2 lg:col-span-4">
                                                      <div className="flex items-center mb-3">
                                                        <div className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-1 rounded-md">
                                                          💰 One-Time Pricing (OTP)
                                                        </div>
                                                        <div className="ml-2 text-xs text-gray-500">
                                                          Upfront costs paid once
                                                        </div>
                                                      </div>
                                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <div>
                                                          <Label className="flex items-center">
                                                            Unit Price (Base)
                                                            <span className="ml-1 text-xs text-gray-500" title="Base price per unit from rate card">ℹ️</span>
                                                          </Label>
                                                          <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.one_time_price || 0}
                                                            onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                              one_time_price: parseFloat(e.target.value) || 0 
                                                            })}
                                                            className="font-mono"
                                                          />
                                                        </div>
                                                        
                                                        <div>
                                                          <Label className="flex items-center">
                                                            Discount %
                                                            <span className="ml-1 text-xs text-gray-500" title="Percentage discount applied to base price">📉</span>
                                                          </Label>
                                                          <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={item.otp_discount_percentage || 0}
                                                            onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                              otp_discount_percentage: parseFloat(e.target.value) || 0 
                                                            })}
                                                            className="font-mono"
                                                          />
                                                        </div>
                                                        
                                                        <div>
                                                          <Label className="text-gray-600">After Discount</Label>
                                                          <Input
                                                            value={`$${(item.discounted_otp || 0).toFixed(2)}`}
                                                            readOnly
                                                            className="bg-blue-50 border-blue-200 font-mono text-blue-900"
                                                          />
                                                        </div>
                                                        
                                                        <div>
                                                          <Label className="text-green-600 font-medium">Total OTP</Label>
                                                          <Input
                                                            value={`$${(item.total_otp || 0).toFixed(2)}`}
                                                            readOnly
                                                            className="bg-green-50 border-green-200 font-bold font-mono text-green-900"
                                                          />
                                                        </div>
                                                      </div>
                                                    </div>
                                                    
                                                    {/* Recurring Pricing Section */}
                                                    <div className="md:col-span-2 lg:col-span-4 mt-6 pt-4 border-t border-gray-200">
                                                      <div className="flex items-center mb-3">
                                                        <div className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-md">
                                                          🔄 Recurring Pricing
                                                        </div>
                                                        <div className="ml-2 text-xs text-gray-500">
                                                          Monthly subscription fees
                                                        </div>
                                                      </div>
                                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        <div>
                                                          <Label className="flex items-center">
                                                            Monthly Rate (Base)
                                                            <span className="ml-1 text-xs text-gray-500" title="Base monthly price per unit">ℹ️</span>
                                                          </Label>
                                                          <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.recurring_price_monthly || 0}
                                                            onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                              recurring_price_monthly: parseFloat(e.target.value) || 0 
                                                            })}
                                                            className="font-mono"
                                                          />
                                                        </div>
                                                        
                                                        <div>
                                                          <Label className="flex items-center">
                                                            Discount %
                                                            <span className="ml-1 text-xs text-gray-500" title="Monthly recurring discount">📉</span>
                                                          </Label>
                                                          <Input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={item.recurring_discount_percentage || 0}
                                                            onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                              recurring_discount_percentage: parseFloat(e.target.value) || 0 
                                                            })}
                                                            className="font-mono"
                                                          />
                                                        </div>
                                                        
                                                        <div>
                                                          <Label>Discounted Recurring/mo (read-only)</Label>
                                                          <Input
                                                            value={`$${(item.discounted_recurring_monthly || 0).toFixed(2)}`}
                                                            readOnly
                                                            className="bg-gray-50"
                                                          />
                                                        </div>
                                                        
                                                        <div>
                                                          <Label>Total Recurring/mo (read-only)</Label>
                                                          <Input
                                                            value={`$${(item.total_recurring_monthly || 0).toFixed(2)}`}
                                                            readOnly
                                                            className="bg-gray-50 font-semibold"
                                                          />
                                                        </div>
                                                      </div>
                                                    </div>
                                                    
                                                    {/* Note Section */}
                                                    <div className="md:col-span-2 lg:col-span-4">
                                                      <Label>Note</Label>
                                                      <Textarea
                                                        value={item.note || ''}
                                                        onChange={(e) => updateItem(phase.id, group.id, item.id, { 
                                                          note: e.target.value 
                                                        })}
                                                        placeholder="Item notes..."
                                                        rows={2}
                                                      />
                                                    </div>
                                                  </div>
                                                ) : (
                                                  // View mode
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                    <div>
                                                      <span className="font-medium">Qty:</span> {item.quantity} | 
                                                      <span className="font-medium"> Hrs:</span> {item.hrs_units}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">OTP:</span> ${(item.total_otp || 0).toFixed(2)}
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">Recurring:</span> ${(item.total_recurring_monthly || 0).toFixed(2)}/mo
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Pricing Summary */}
          <div className="xl:col-span-1">
            <div className="sticky top-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Pricing Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Quotation OTP</span>
                      <span className="font-medium">${totals.quotation_otp.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Recurring (Monthly)</span>
                      <span className="font-medium">${totals.quotation_recurring_monthly.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Recurring (Total Tenure)</span>
                      <span className="font-medium">${totals.quotation_recurring_total_tenure.toFixed(2)}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">Grand Total</span>
                      <span className="text-lg font-bold text-blue-600">${totals.grand_total.toFixed(2)}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2">
                      Grand Total = OTP + Recurring (Total Tenure)
                    </div>
                    
                    <Separator />
                    
                    {/* Phase-wise breakdown */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Phase Breakdown</h4>
                      <div className="space-y-2">
                        {phases.map((phase) => (
                          <div key={phase.id} className="text-xs">
                            <div className="font-medium text-gray-700">{phase.phase_name}</div>
                            <div className="flex justify-between text-gray-600 ml-2">
                              <span>OTP:</span>
                              <span>${(phase.phase_otp || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600 ml-2">
                              <span>Rec ({phase.tenure_months || 12}mo):</span>
                              <span>${(phase.phase_recurring_tenure || 0).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Product Search Dialog */}
      <Dialog open={showProductSearch} onOpenChange={setShowProductSearch}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search products by name, SKU, or category..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex-1 overflow-y-auto border rounded-md">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No products found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={async () => {
                        if (selectedGroupForProduct) {
                          await addItemToGroup(
                            selectedGroupForProduct.phaseId,
                            selectedGroupForProduct.groupId,
                            product
                          );
                        }
                        setShowProductSearch(false);
                        setSelectedGroupForProduct(null);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{product.core_product_name}</h4>
                          <p className="text-sm text-gray-600 mt-1">SKU: {product.skucode}</p>
                          <div className="flex space-x-2 mt-2">
                            <Badge variant="outline">{product.primary_category}</Badge>
                            {product.secondary_category && (
                              <Badge variant="outline">{product.secondary_category}</Badge>
                            )}
                          </div>
                        </div>
                        <Button size="sm">
                          Select
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuotationManagement;