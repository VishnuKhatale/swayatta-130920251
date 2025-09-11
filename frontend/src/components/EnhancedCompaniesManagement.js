import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Upload,
  RefreshCw, 
  Eye, 
  Edit, 
  Trash2,
  Building,
  MapPin,
  FileText,
  DollarSign,
  User,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  AlertCircle,
  Info,
  Users,
  Factory,
  Shield
} from 'lucide-react';
import axios from 'axios';
import DataTable from './DataTable';
import ProtectedComponent from './ProtectedComponent';

const EnhancedCompaniesManagement = () => {
  // State management
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Form state
  const [companyFormData, setCompanyFormData] = useState({
    // Basic Information
    company_name: '',
    company_type: '',
    account_type: '',
    business_type: '',
    industry_id: '',
    sub_industry_id: '',
    region: '',
    is_child_company: false,
    parent_company_id: '',
    
    // Address Information
    address: '',
    country_id: '',
    state_id: '',
    city_id: '',
    status: true,
    
    // Document Information
    pan_number: '',
    gst_number: '',
    vat_number: '',
    website: '',
    billing_record_id: '',
    
    // Financial Information
    employee_count: 0,
    annual_revenue: '',
    currency_id: '',
    
    // Contact Information
    contact_person: '',
    email: '',
    phone: '',
    remarks: ''
  });
  
  const [validationErrors, setValidationErrors] = useState({});
  
  // Master data state
  const [masterData, setMasterData] = useState({
    businessTypes: [],
    industries: [],
    subIndustries: [],
    countries: [],
    states: [],
    cities: [],
    currencies: [],
    companies: [] // For parent company dropdown
  });

  // Statistics state
  const [statistics, setStatistics] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    domesticCompanies: 0,
    internationalCompanies: 0,
    gcApprovalRequired: 0
  });

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
    fetchCompanies();
    fetchMasterData();
  }, []);

  // Fetch companies
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/companies/enhanced`, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setCompanies(response.data.data);
        calculateStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error(error.response?.data?.detail || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

  // Fetch master data
  const fetchMasterData = async () => {
    try {
      const endpoints = [
        'master/business-types',
        'master/industries',
        'master/countries',
        'master/currencies'
      ];

      const responses = await Promise.all(
        endpoints.map(endpoint =>
          axios.get(`${API_BASE_URL}/api/${endpoint}`, {
            headers: getAuthHeaders()
          }).catch(err => ({ data: { success: false, data: [] } }))
        )
      );

      const [businessTypesRes, industriesRes, countriesRes, currenciesRes] = responses;

      setMasterData(prev => ({
        ...prev,
        businessTypes: businessTypesRes.data.success ? businessTypesRes.data.data : [],
        industries: industriesRes.data.success ? industriesRes.data.data : [],
        countries: countriesRes.data.success ? countriesRes.data.data : [],
        currencies: currenciesRes.data.success ? currenciesRes.data.data : [],
        companies: companies // For parent company dropdown
      }));
    } catch (error) {
      console.error('Error fetching master data:', error);
      toast.error('Failed to fetch master data');
    }
  };

  // Calculate statistics
  const calculateStatistics = (companiesData) => {
    const totalCompanies = companiesData.length;
    const activeCompanies = companiesData.filter(c => c.status).length;
    const domesticCompanies = companiesData.filter(c => c.business_type === 'Domestic').length;
    const internationalCompanies = companiesData.filter(c => c.business_type === 'International').length;
    const gcApprovalRequired = companiesData.filter(c => c.gc_approval_flag).length;

    setStatistics({
      totalCompanies,
      activeCompanies,
      domesticCompanies,
      internationalCompanies,
      gcApprovalRequired
    });
  };

  // Handle cascading dropdowns
  const handleIndustryChange = async (industryId) => {
    setCompanyFormData(prev => ({
      ...prev,
      industry_id: industryId,
      sub_industry_id: '' // Reset sub-industry
    }));

    if (industryId) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/master/industries/${industryId}/sub-industries`, {
          headers: getAuthHeaders()
        });
        
        if (response.data.success) {
          setMasterData(prev => ({
            ...prev,
            subIndustries: response.data.data
          }));
        }
      } catch (error) {
        console.error('Error fetching sub-industries:', error);
      }
    }
  };

  const handleCountryChange = async (countryId) => {
    setCompanyFormData(prev => ({
      ...prev,
      country_id: countryId,
      state_id: '', // Reset state
      city_id: '' // Reset city
    }));

    if (countryId) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/master/countries/${countryId}/states`, {
          headers: getAuthHeaders()
        });
        
        if (response.data.success) {
          setMasterData(prev => ({
            ...prev,
            states: response.data.data,
            cities: [] // Reset cities
          }));
        }
      } catch (error) {
        console.error('Error fetching states:', error);
      }
    }
  };

  const handleStateChange = async (stateId) => {
    setCompanyFormData(prev => ({
      ...prev,
      state_id: stateId,
      city_id: '' // Reset city
    }));

    if (stateId) {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/master/states/${stateId}/cities`, {
          headers: getAuthHeaders()
        });
        
        if (response.data.success) {
          setMasterData(prev => ({
            ...prev,
            cities: response.data.data
          }));
        }
      } catch (error) {
        console.error('Error fetching cities:', error);
      }
    }
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setCompanyFormData(prev => ({
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

    // Handle business type validation requirements
    if (field === 'business_type') {
      if (value === 'Domestic') {
        // Make PAN and GST required
        setValidationErrors(prev => ({
          ...prev,
          pan_number: !companyFormData.pan_number ? 'PAN is required for Domestic companies' : undefined,
          gst_number: !companyFormData.gst_number ? 'GST is required for Domestic companies' : undefined
        }));
      } else if (value === 'International') {
        // Make VAT required
        setValidationErrors(prev => ({
          ...prev,
          vat_number: !companyFormData.vat_number ? 'VAT is required for International companies' : undefined
        }));
      }
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    // Basic validations
    if (!companyFormData.company_name.trim()) {
      errors.company_name = 'Company name is required';
    }
    if (!companyFormData.company_type) {
      errors.company_type = 'Company type is required';
    }
    if (!companyFormData.account_type) {
      errors.account_type = 'Account type is required';
    }
    if (!companyFormData.business_type) {
      errors.business_type = 'Business type is required';
    }
    if (!companyFormData.industry_id) {
      errors.industry_id = 'Industry is required';
    }
    if (!companyFormData.region) {
      errors.region = 'Region is required';
    }
    if (!companyFormData.address.trim()) {
      errors.address = 'Address is required';
    }
    if (!companyFormData.country_id) {
      errors.country_id = 'Country is required';
    }
    if (!companyFormData.state_id) {
      errors.state_id = 'State is required';
    }
    if (!companyFormData.city_id) {
      errors.city_id = 'City is required';
    }
    if (!companyFormData.billing_record_id.trim()) {
      errors.billing_record_id = 'Billing Record ID is required';
    }

    // Business type specific validations
    if (companyFormData.business_type === 'Domestic') {
      if (!companyFormData.pan_number.trim()) {
        errors.pan_number = 'PAN is required for Domestic companies';
      }
      if (!companyFormData.gst_number.trim()) {
        errors.gst_number = 'GST is required for Domestic companies';
      }
    } else if (companyFormData.business_type === 'International') {
      if (!companyFormData.vat_number.trim()) {
        errors.vat_number = 'VAT is required for International companies';
      }
    }

    // Child company validation
    if (companyFormData.is_child_company && !companyFormData.parent_company_id) {
      errors.parent_company_id = 'Parent company is required for child companies';
    }

    // Revenue currency validation
    if (companyFormData.annual_revenue && !companyFormData.currency_id) {
      errors.currency_id = 'Currency is required when annual revenue is provided';
    }

    // Email validation
    if (companyFormData.email && !/\S+@\S+\.\S+/.test(companyFormData.email)) {
      errors.email = 'Invalid email format';
    }

    // Website validation
    if (companyFormData.website && !/^https?:\/\/.+/.test(companyFormData.website)) {
      errors.website = 'Website must be a valid URL starting with http:// or https://';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setCompanyFormData({
      company_name: '',
      company_type: '',
      account_type: '',
      business_type: '',
      industry_id: '',
      sub_industry_id: '',
      region: '',
      is_child_company: false,
      parent_company_id: '',
      address: '',
      country_id: '',
      state_id: '',
      city_id: '',
      status: true,
      pan_number: '',
      gst_number: '',
      vat_number: '',
      website: '',
      billing_record_id: '',
      employee_count: 0,
      annual_revenue: '',
      currency_id: '',
      contact_person: '',
      email: '',
      phone: '',
      remarks: ''
    });
    setValidationErrors({});
    setActiveTab('basic');
  };

  // Handle create company
  const handleCreateCompany = async () => {
    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/api/companies/enhanced`, companyFormData, {
        headers: getAuthHeaders()
      });

      if (response.data.success) {
        toast.success('Company created successfully');
        setShowCreateDialog(false);
        resetForm();
        fetchCompanies();
      }
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error(error.response?.data?.detail || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  // Render basic information tab
  const renderBasicInformation = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={companyFormData.company_name}
            onChange={(e) => handleInputChange('company_name', e.target.value)}
            placeholder="Enter company name"
            className={validationErrors.company_name ? 'border-red-500' : ''}
          />
          {validationErrors.company_name && (
            <p className="text-sm text-red-500">{validationErrors.company_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Company Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.company_type}
            onValueChange={(value) => handleInputChange('company_type', value)}
          >
            <SelectTrigger className={validationErrors.company_type ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select company type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Private">Private</SelectItem>
              <SelectItem value="Public">Public</SelectItem>
              <SelectItem value="LLP">LLP</SelectItem>
              <SelectItem value="Government">Government</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.company_type && (
            <p className="text-sm text-red-500">{validationErrors.company_type}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Account Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.account_type}
            onValueChange={(value) => handleInputChange('account_type', value)}
          >
            <SelectTrigger className={validationErrors.account_type ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Customer">Customer</SelectItem>
              <SelectItem value="Partner">Partner</SelectItem>
              <SelectItem value="Vendor">Vendor</SelectItem>
              <SelectItem value="Prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.account_type && (
            <p className="text-sm text-red-500">{validationErrors.account_type}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Business Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.business_type}
            onValueChange={(value) => handleInputChange('business_type', value)}
          >
            <SelectTrigger className={validationErrors.business_type ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent>
              {masterData.businessTypes.map((type) => (
                <SelectItem key={type.id} value={type.business_type_name}>
                  {type.business_type_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.business_type && (
            <p className="text-sm text-red-500">{validationErrors.business_type}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Industry <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.industry_id}
            onValueChange={(value) => handleIndustryChange(value)}
          >
            <SelectTrigger className={validationErrors.industry_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {masterData.industries.map((industry) => (
                <SelectItem key={industry.id} value={industry.id}>
                  {industry.industry_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.industry_id && (
            <p className="text-sm text-red-500">{validationErrors.industry_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Sub-Industry</Label>
          <Select
            value={companyFormData.sub_industry_id}
            onValueChange={(value) => handleInputChange('sub_industry_id', value)}
            disabled={!companyFormData.industry_id}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select sub-industry" />
            </SelectTrigger>
            <SelectContent>
              {masterData.subIndustries.map((subIndustry) => (
                <SelectItem key={subIndustry.id} value={subIndustry.id}>
                  {subIndustry.sub_industry_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            Region <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.region}
            onValueChange={(value) => handleInputChange('region', value)}
          >
            <SelectTrigger className={validationErrors.region ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APAC">Asia Pacific</SelectItem>
              <SelectItem value="EMEA">Europe, Middle East & Africa</SelectItem>
              <SelectItem value="NA">North America</SelectItem>
              <SelectItem value="LATAM">Latin America</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.region && (
            <p className="text-sm text-red-500">{validationErrors.region}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_child_company"
            checked={companyFormData.is_child_company}
            onCheckedChange={(checked) => handleInputChange('is_child_company', checked)}
          />
          <Label htmlFor="is_child_company">Is Child Company?</Label>
        </div>

        {companyFormData.is_child_company && (
          <div className="space-y-2">
            <Label>
              Parent Company <span className="text-red-500">*</span>
            </Label>
            <Select
              value={companyFormData.parent_company_id}
              onValueChange={(value) => handleInputChange('parent_company_id', value)}
            >
              <SelectTrigger className={validationErrors.parent_company_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select parent company" />
              </SelectTrigger>
              <SelectContent>
                {companies.filter(c => c.id !== selectedCompany?.id).map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.parent_company_id && (
              <p className="text-sm text-red-500">{validationErrors.parent_company_id}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render address information tab
  const renderAddressInformation = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          Address <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={companyFormData.address}
          onChange={(e) => handleInputChange('address', e.target.value)}
          placeholder="Enter complete address"
          rows={3}
          className={validationErrors.address ? 'border-red-500' : ''}
        />
        {validationErrors.address && (
          <p className="text-sm text-red-500">{validationErrors.address}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>
            Country <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.country_id}
            onValueChange={(value) => handleCountryChange(value)}
          >
            <SelectTrigger className={validationErrors.country_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {masterData.countries.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {country.country_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.country_id && (
            <p className="text-sm text-red-500">{validationErrors.country_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            State <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.state_id}
            onValueChange={(value) => handleStateChange(value)}
            disabled={!companyFormData.country_id}
          >
            <SelectTrigger className={validationErrors.state_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {masterData.states.map((state) => (
                <SelectItem key={state.id} value={state.id}>
                  {state.state_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.state_id && (
            <p className="text-sm text-red-500">{validationErrors.state_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            City <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyFormData.city_id}
            onValueChange={(value) => handleInputChange('city_id', value)}
            disabled={!companyFormData.state_id}
          >
            <SelectTrigger className={validationErrors.city_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select city" />
            </SelectTrigger>
            <SelectContent>
              {masterData.cities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.city_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.city_id && (
            <p className="text-sm text-red-500">{validationErrors.city_id}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="status"
            checked={companyFormData.status}
            onCheckedChange={(checked) => handleInputChange('status', checked)}
          />
          <Label htmlFor="status">Active</Label>
        </div>
      </div>
    </div>
  );

  // Render document information tab
  const renderDocumentInformation = () => (
    <div className="space-y-4">
      {/* Business Type Requirements Alert */}
      {companyFormData.business_type && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {companyFormData.business_type === 'Domestic' 
              ? 'PAN and GST numbers are required for Domestic companies'
              : 'VAT number is required for International companies'
            }
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            PAN Number {companyFormData.business_type === 'Domestic' && <span className="text-red-500">*</span>}
          </Label>
          <Input
            value={companyFormData.pan_number}
            onChange={(e) => handleInputChange('pan_number', e.target.value.toUpperCase())}
            placeholder="Enter PAN number"
            className={validationErrors.pan_number ? 'border-red-500' : ''}
          />
          {validationErrors.pan_number && (
            <p className="text-sm text-red-500">{validationErrors.pan_number}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            GST Number {companyFormData.business_type === 'Domestic' && <span className="text-red-500">*</span>}
          </Label>
          <Input
            value={companyFormData.gst_number}
            onChange={(e) => handleInputChange('gst_number', e.target.value.toUpperCase())}
            placeholder="Enter GST number"
            className={validationErrors.gst_number ? 'border-red-500' : ''}
          />
          {validationErrors.gst_number && (
            <p className="text-sm text-red-500">{validationErrors.gst_number}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            VAT Number {companyFormData.business_type === 'International' && <span className="text-red-500">*</span>}
          </Label>
          <Input
            value={companyFormData.vat_number}
            onChange={(e) => handleInputChange('vat_number', e.target.value.toUpperCase())}
            placeholder="Enter VAT number"
            className={validationErrors.vat_number ? 'border-red-500' : ''}
          />
          {validationErrors.vat_number && (
            <p className="text-sm text-red-500">{validationErrors.vat_number}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Website</Label>
          <Input
            value={companyFormData.website}
            onChange={(e) => handleInputChange('website', e.target.value)}
            placeholder="https://example.com"
            className={validationErrors.website ? 'border-red-500' : ''}
          />
          {validationErrors.website && (
            <p className="text-sm text-red-500">{validationErrors.website}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>
            Billing Record ID <span className="text-red-500">*</span>
          </Label>
          <Input
            value={companyFormData.billing_record_id}
            onChange={(e) => handleInputChange('billing_record_id', e.target.value)}
            placeholder="Enter unique billing record ID"
            className={validationErrors.billing_record_id ? 'border-red-500' : ''}
          />
          {validationErrors.billing_record_id && (
            <p className="text-sm text-red-500">{validationErrors.billing_record_id}</p>
          )}
        </div>
      </div>
    </div>
  );

  // Render financial information tab
  const renderFinancialInformation = () => {
    // Calculate GC Approval Flag
    const shouldRequireGCApproval = () => {
      const revenue = parseFloat(companyFormData.annual_revenue) || 0;
      const selectedIndustry = masterData.industries.find(i => i.id === companyFormData.industry_id);
      const industryName = selectedIndustry?.industry_name || '';
      
      return revenue > 8300000 || ['BFSI', 'Healthcare'].includes(industryName); // $1M ≈ 83L INR
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Employee Count</Label>
            <Input
              type="number"
              value={companyFormData.employee_count}
              onChange={(e) => handleInputChange('employee_count', parseInt(e.target.value) || 0)}
              placeholder="Enter employee count"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Annual Revenue</Label>
            <Input
              type="number"
              value={companyFormData.annual_revenue}
              onChange={(e) => handleInputChange('annual_revenue', e.target.value)}
              placeholder="Enter annual revenue"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Currency {companyFormData.annual_revenue && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={companyFormData.currency_id}
              onValueChange={(value) => handleInputChange('currency_id', value)}
              disabled={!companyFormData.annual_revenue}
            >
              <SelectTrigger className={validationErrors.currency_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {masterData.currencies.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.currency_name} ({currency.currency_symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.currency_id && (
              <p className="text-sm text-red-500">{validationErrors.currency_id}</p>
            )}
          </div>
        </div>

        {/* GC Approval Flag Display */}
        {shouldRequireGCApproval() && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>GC Approval Required</span>
              </div>
              <p className="text-sm mt-1">
                This company requires GC approval due to:
                {parseFloat(companyFormData.annual_revenue) > 8300000 && ' Annual revenue > $1M'}
                {parseFloat(companyFormData.annual_revenue) > 8300000 && 
                 ['BFSI', 'Healthcare'].includes(masterData.industries.find(i => i.id === companyFormData.industry_id)?.industry_name) && ', '}
                {['BFSI', 'Healthcare'].includes(masterData.industries.find(i => i.id === companyFormData.industry_id)?.industry_name) && 
                 ' Industry type (BFSI/Healthcare)'}
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  // Render contact information tab
  const renderContactInformation = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact Person</Label>
          <Input
            value={companyFormData.contact_person}
            onChange={(e) => handleInputChange('contact_person', e.target.value)}
            placeholder="Enter contact person name"
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={companyFormData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="Enter email address"
            className={validationErrors.email ? 'border-red-500' : ''}
          />
          {validationErrors.email && (
            <p className="text-sm text-red-500">{validationErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={companyFormData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="Enter phone number"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Remarks</Label>
        <Textarea
          value={companyFormData.remarks}
          onChange={(e) => handleInputChange('remarks', e.target.value)}
          placeholder="Enter any additional remarks"
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <ProtectedComponent requiredPermission="/companies" requiredAction="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Company Management</h1>
            <p className="text-gray-600">Manage companies with comprehensive business rules and validations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchCompanies} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ProtectedComponent requiredPermission="/companies" requiredAction="create">
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            </ProtectedComponent>
          </div>
        </div>

        {/* Enhanced Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Companies</p>
                  <p className="text-2xl font-bold">{statistics.totalCompanies}</p>
                </div>
                <Building className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold">{statistics.activeCompanies}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Domestic</p>
                  <p className="text-2xl font-bold">{statistics.domesticCompanies}</p>
                </div>
                <MapPin className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">International</p>
                  <p className="text-2xl font-bold">{statistics.internationalCompanies}</p>
                </div>
                <Globe className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">GC Approval</p>
                  <p className="text-2xl font-bold">{statistics.gcApprovalRequired}</p>
                </div>
                <Shield className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle>Companies List</CardTitle>
            <CardDescription>
              Comprehensive list of all companies with enhanced business information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={companies}
              columns={[
                {
                  key: 'company_name',
                  header: 'Company Name',
                  sortable: true,
                  render: (value, row) => (
                    <div className="font-medium">
                      <div>{value}</div>
                      <div className="text-sm text-gray-500">{row.billing_record_id}</div>
                    </div>
                  )
                },
                {
                  key: 'company_type',
                  header: 'Type',
                  sortable: true,
                  render: (value) => (
                    <Badge variant="outline">{value}</Badge>
                  )
                },
                {
                  key: 'business_type',
                  header: 'Business Type',
                  sortable: true,
                  render: (value) => (
                    <Badge variant={value === 'Domestic' ? 'default' : 'secondary'}>
                      {value}
                    </Badge>
                  )
                },
                {
                  key: 'account_type',
                  header: 'Account Type',
                  sortable: true
                },
                {
                  key: 'industry_name',
                  header: 'Industry',
                  sortable: true,
                  render: (value, row) => (
                    <div>
                      <div className="font-medium">{value}</div>
                      {row.sub_industry_name && (
                        <div className="text-sm text-gray-500">{row.sub_industry_name}</div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'region',
                  header: 'Region',
                  sortable: true
                },
                {
                  key: 'country_name',
                  header: 'Location',
                  sortable: true,
                  render: (value, row) => (
                    <div>
                      <div>{row.city_name}, {row.state_name}</div>
                      <div className="text-sm text-gray-500">{value}</div>
                    </div>
                  )
                },
                {
                  key: 'gc_approval_flag',
                  header: 'GC Approval',
                  render: (value) => (
                    value ? (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Required</Badge>
                    )
                  )
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  render: (value) => (
                    <Badge variant={value ? 'default' : 'secondary'}>
                      {value ? 'Active' : 'Inactive'}
                    </Badge>
                  )
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  sortable: false,
                  render: (_, company) => (
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setSelectedCompany(company);
                          setShowViewDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <ProtectedComponent requiredPermission="/companies" requiredAction="edit">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedCompany(company);
                            setCompanyFormData({
                              ...company,
                              annual_revenue: company.annual_revenue?.toString() || ''
                            });
                            setShowCreateDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </ProtectedComponent>
                      <ProtectedComponent requiredPermission="/companies" requiredAction="delete">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            // Handle delete - to be implemented
                            toast.info('Delete functionality will be implemented');
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </ProtectedComponent>
                    </div>
                  )
                }
              ]}
              searchable={true}
              exportable={true}
            />
          </CardContent>
        </Card>

        {/* Create/Edit Company Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {selectedCompany ? 'Edit Company' : 'Create New Company'}
              </DialogTitle>
              <DialogDescription>
                {selectedCompany ? 'Update company information' : 'Add a new company with comprehensive business details'}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-base">Basic Information</CardTitle>
                  <CardDescription>Company classification and business details</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderBasicInformation()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="address" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-base">Address Information</CardTitle>
                  <CardDescription>Location and geographical details</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderAddressInformation()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="documents" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-base">Document Information</CardTitle>
                  <CardDescription>Legal documents and compliance requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderDocumentInformation()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="financial" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-base">Financial Information</CardTitle>
                  <CardDescription>Revenue and financial details</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderFinancialInformation()}
                </CardContent>
              </TabsContent>
              
              <TabsContent value="contact" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                  <CardDescription>Primary contact details</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderContactInformation()}
                </CardContent>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-2 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                  setSelectedCompany(null);
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateCompany} disabled={loading}>
                {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                {selectedCompany ? 'Update Company' : 'Create Company'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Company Dialog - Simplified for now */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>View Company Details</DialogTitle>
            </DialogHeader>
            
            {selectedCompany && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Company Name</Label>
                    <p className="font-medium">{selectedCompany.company_name}</p>
                  </div>
                  <div>
                    <Label>Business Type</Label>
                    <p className="font-medium">{selectedCompany.business_type}</p>
                  </div>
                  <div>
                    <Label>Industry</Label>
                    <p className="font-medium">{selectedCompany.industry_name}</p>
                  </div>
                  <div>
                    <Label>Region</Label>
                    <p className="font-medium">{selectedCompany.region}</p>
                  </div>
                </div>
                
                {selectedCompany.gc_approval_flag && (
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      This company requires GC approval
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedComponent>
  );
};

export default EnhancedCompaniesManagement;