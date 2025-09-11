import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { useToast } from '../hooks/use-toast';
import ProtectedComponent from './ProtectedComponent';
import { usePermissions } from '../contexts/PermissionContext';
import DataTable from './DataTable';
import { Plus, Eye, Edit, Trash2, Upload, User, Building, MapPin, Briefcase } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UserManagementFixed = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [businessVerticals, setBusinessVerticals] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [newUser, setNewUser] = useState({
    name: '',
    full_name: '',
    username: '',
    email: '',
    password: '',
    contact_no: '',
    gender: '',
    dob: '',
    designation: '',
    role_id: '',
    department_id: '',
    sub_department_id: '',
    is_reporting: false,
    reporting_to: '',
    region: '',
    address: '',
    business_verticals: []
  });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // Gender options
  const genderOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' }
  ];

  // Region options
  const regionOptions = [
    { value: 'North', label: 'North' },
    { value: 'South', label: 'South' },
    { value: 'East', label: 'East' },
    { value: 'West', label: 'West' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const [usersRes, rolesRes, deptsRes, verticalsRes, activeUsersRes] = await Promise.all([
        axios.get(`${API}/users`, config),
        axios.get(`${API}/roles`, config),
        axios.get(`${API}/departments`, config),
        axios.get(`${API}/business-verticals`, config),
        axios.get(`${API}/users/active`, config)
      ]);

      if (usersRes.data.success) setUsers(usersRes.data.data);
      if (rolesRes.data.success) setRoles(rolesRes.data.data);
      if (deptsRes.data.success) setDepartments(deptsRes.data.data);
      if (verticalsRes.data.success) setBusinessVerticals(verticalsRes.data.data);
      if (activeUsersRes.data.success) setActiveUsers(activeUsersRes.data.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubDepartments = async (departmentId) => {
    if (!departmentId) {
      setSubDepartments([]);
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API}/departments/${departmentId}/sub-departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSubDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch sub-departments:', error);
      setSubDepartments([]);
    }
  };

  const validateField = (name, value) => {
    const errors = { ...validationErrors };

    switch (name) {
      case 'name':
        if (!value) {
          errors[name] = 'Name is required';
        } else {
          delete errors[name];
        }
        break;
      case 'full_name':
        if (value && !/^[a-zA-Z\s]+$/.test(value)) {
          errors[name] = 'Full name can only contain alphabets and spaces';
        } else {
          delete errors[name];
        }
        break;
      case 'username':
        if (value && /\s/.test(value)) {
          errors[name] = 'Username cannot contain spaces';
        } else {
          delete errors[name];
        }
        break;
      case 'email':
        if (!value) {
          errors[name] = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors[name] = 'Please enter a valid email address';
        } else {
          delete errors[name];
        }
        break;
      case 'contact_no':
        if (value && !/^\d{1,15}$/.test(value)) {
          errors[name] = 'Contact number must be numeric and max 15 digits';
        } else {
          delete errors[name];
        }
        break;
      case 'dob':
        if (value) {
          const dobDate = new Date(value);
          const today = new Date();
          if (dobDate >= today) {
            errors[name] = 'Date of birth must be in the past';
          } else {
            delete errors[name];
          }
        } else {
          delete errors[name];
        }
        break;
      case 'password':
        if (!value && !selectedUser) {
          errors[name] = 'Password is required';
        } else {
          delete errors[name];
        }
        break;
      case 'role_id':
        if (!value) {
          errors[name] = 'Role is required';
        } else {
          delete errors[name];
        }
        break;
      default:
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (name, value) => {
    if (selectedUser) {
      setSelectedUser({ ...selectedUser, [name]: value });
    } else {
      setNewUser({ ...newUser, [name]: value });
    }
    validateField(name, value);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Only image files (JPEG, PNG, GIF, WebP) are allowed",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setProfilePhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const uploadProfilePhoto = async () => {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API}/upload/profile-photo`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        return response.data.data.file_path;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload profile photo",
        variant: "destructive",
      });
    }
    return null;
  };

  const validateForm = (userData) => {
    const requiredFields = ['name', 'email', 'role_id'];
    if (!selectedUser) requiredFields.push('password');
    
    let isValid = true;
    const errors = {};

    requiredFields.forEach(field => {
      if (!userData[field]) {
        errors[field] = `${field.replace('_', ' ')} is required`;
        isValid = false;
      }
    });

    // Validate other fields
    if (userData.full_name && !/^[a-zA-Z\s]+$/.test(userData.full_name)) {
      errors.full_name = 'Full name can only contain alphabets and spaces';
      isValid = false;
    }

    if (userData.username && /\s/.test(userData.username)) {
      errors.username = 'Username cannot contain spaces';
      isValid = false;
    }

    if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (userData.contact_no && !/^\d{1,15}$/.test(userData.contact_no)) {
      errors.contact_no = 'Contact number must be numeric and max 15 digits';
      isValid = false;
    }

    if (userData.dob) {
      const dobDate = new Date(userData.dob);
      const today = new Date();
      if (dobDate >= today) {
        errors.dob = 'Date of birth must be in the past';
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleCreateUser = async () => {
    if (!validateForm(newUser)) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    try {
      let userData = { ...newUser };
      
      // Upload profile photo if selected
      if (selectedFile) {
        const photoPath = await uploadProfilePhoto();
        if (photoPath) {
          userData.profile_photo = photoPath;
        }
      }

      const token = localStorage.getItem('access_token');
      const response = await axios.post(`${API}/users`, userData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "User created successfully",
        });
        resetForm();
        setIsCreateDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = async () => {
    if (!validateForm(selectedUser)) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }

    try {
      let userData = { ...selectedUser };
      
      // Upload new profile photo if selected
      if (selectedFile) {
        const photoPath = await uploadProfilePhoto();
        if (photoPath) {
          userData.profile_photo = photoPath;
        }
      }

      const token = localStorage.getItem('access_token');
      const response = await axios.put(`${API}/users/${userData.id}`, userData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "User updated successfully",
        });
        setIsEditDialogOpen(false);
        fetchData();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`Are you sure you want to delete user: ${userName}?`)) {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.delete(`${API}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          toast({
            title: "Success",
            description: "User deleted successfully",
          });
          fetchData();
        }
      } catch (error) {
        toast({
          title: "Error",
          description: error.response?.data?.detail || "Failed to delete user",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setNewUser({
      name: '',
      full_name: '',
      username: '',
      email: '',
      password: '',
      contact_no: '',
      gender: '',
      dob: '',
      designation: '',
      role_id: '',
      department_id: '',
      sub_department_id: '',
      is_reporting: false,
      reporting_to: '',
      region: '',
      address: '',
      business_verticals: []
    });
    setProfilePhotoPreview('');
    setSelectedFile(null);
    setSubDepartments([]);
    setValidationErrors({});
  };

  const openEditDialog = (user) => {
    setSelectedUser({ ...user });
    setProfilePhotoPreview(user.profile_photo ? `${BACKEND_URL}${user.profile_photo}` : '');
    setValidationErrors({});
    if (user.department_id) {
      fetchSubDepartments(user.department_id);
    }
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (user) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role?.name || 'Unknown';
  };

  const getDepartmentName = (deptId) => {
    if (!deptId) return 'No Department';
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || 'Unknown';
  };

  const getBusinessVerticalNames = (verticalIds) => {
    if (!verticalIds || !Array.isArray(verticalIds)) return 'None';
    const names = verticalIds.map(id => {
      const vertical = businessVerticals.find(v => v.id === id);
      return vertical?.name || 'Unknown';
    });
    return names.join(', ') || 'None';
  };

  const handleExportUsers = (data) => {
    const headers = ['Name', 'Full Name', 'Username', 'Email', 'Contact', 'Gender', 'DOB', 'Role', 'Department', 'Designation', 'Region', 'Business Verticals', 'Status', 'Created At'];
    const rows = data.map(user => [
      user.name,
      user.full_name || '',
      user.username || '',
      user.email,
      user.contact_no || '',
      user.gender || '',
      user.dob ? new Date(user.dob).toLocaleDateString() : '',
      getRoleName(user.role_id),
      getDepartmentName(user.department_id),
      user.designation || '',
      user.region || '',
      getBusinessVerticalNames(user.business_verticals),
      user.is_active ? 'Active' : 'Inactive',
      new Date(user.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'users_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const userColumns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true
    },
    {
      key: 'full_name',
      header: 'Full Name',
      sortable: true,
      render: (value) => value || 'Not provided'
    },
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      render: (value) => value || 'Not set'
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true
    },
    {
      key: 'contact_no',
      header: 'Contact',
      render: (value) => value || 'Not provided'
    },
    {
      key: 'role_id',
      header: 'Role',
      render: (value) => (
        <Badge variant="secondary">{getRoleName(value)}</Badge>
      )
    },
    {
      key: 'department_id',
      header: 'Department', 
      render: (value) => getDepartmentName(value)
    },
    {
      key: 'designation',
      header: 'Designation',
      render: (value) => value || 'Not assigned'
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
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (_, user) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => openViewDialog(user)}>
            <Eye className="h-4 w-4" />
          </Button>
          <ProtectedComponent menuPath="/users" permission="edit">
            <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
              <Edit className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
          <ProtectedComponent menuPath="/users" permission="delete">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-600 hover:text-red-800"
              onClick={() => handleDeleteUser(user.id, user.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ProtectedComponent>
        </div>
      )
    }
  ];

  const createUserAction = (
    <ProtectedComponent menuPath="/users" permission="create">
      <Button 
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => {
          resetForm();
          setIsCreateDialogOpen(true);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add User
      </Button>
    </ProtectedComponent>
  );

  const renderFormField = (id, label, value, onChange, type = 'text', required = false, options = null, error = null, placeholder = '') => (
    <div>
      <Label htmlFor={id}>{label} {required && <span className="text-red-500">*</span>}</Label>
      {type === 'select' && options ? (
        <Select value={value || ''} onValueChange={(val) => onChange(id.replace(/-/g, '_'), val)}>
          <SelectTrigger className={error ? 'border-red-500' : ''}>
            <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value || option.id} value={option.value || option.id}>
                {option.label || option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === 'textarea' ? (
        <Textarea
          id={id}
          value={value || ''}
          onChange={(e) => onChange(id.replace(/-/g, '_'), e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={error ? 'border-red-500' : ''}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value || ''}
          onChange={(e) => onChange(id.replace(/-/g, '_'), e.target.value)}
          placeholder={placeholder}
          max={type === 'date' ? new Date().toISOString().split('T')[0] : undefined}
          className={error ? 'border-red-500' : ''}
        />
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600">Manage system users and their comprehensive information</p>
        </div>
      </div>

      <DataTable
        data={users}
        columns={userColumns}
        title="Users"
        searchable={true}
        exportable={true}
        onExport={handleExportUsers}
        onRefresh={fetchData}
        loading={loading}
        actions={createUserAction}
        pageSize={10}
      />

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Create New User
            </DialogTitle>
            <DialogDescription>Add a new user to the system with comprehensive information</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderFormField('create-name', 'Name', newUser.name, handleInputChange, 'text', true, null, validationErrors.name, 'Enter display name')}
                {renderFormField('create-full-name', 'Full Name', newUser.full_name, handleInputChange, 'text', false, null, validationErrors.full_name, 'Enter full legal name')}
                {renderFormField('create-username', 'Username', newUser.username, handleInputChange, 'text', false, null, validationErrors.username, 'Enter username (no spaces)')}
                {renderFormField('create-email', 'Email', newUser.email, handleInputChange, 'email', true, null, validationErrors.email, 'Enter email address')}
                {renderFormField('create-password', 'Password', newUser.password, handleInputChange, 'password', true, null, validationErrors.password, 'Enter password')}
                {renderFormField('create-contact-no', 'Contact Number', newUser.contact_no, handleInputChange, 'text', false, null, validationErrors.contact_no, 'Enter contact number (digits only)')}
                {renderFormField('create-gender', 'Gender', newUser.gender, handleInputChange, 'select', false, genderOptions, validationErrors.gender)}
                {renderFormField('create-dob', 'Date of Birth', newUser.dob, handleInputChange, 'date', false, null, validationErrors.dob)}

                {/* Profile Photo Upload */}
                <div>
                  <Label htmlFor="create-photo">Profile Photo</Label>
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {profilePhotoPreview ? (
                          <img src={profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-8 w-8 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <Input
                          id="create-photo"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => document.getElementById('create-photo').click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Photo
                        </Button>
                        <p className="text-xs text-gray-500 mt-1">Max 5MB, JPEG/PNG/GIF/WebP</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Information Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Professional Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderFormField('create-role-id', 'Role', newUser.role_id, handleInputChange, 'select', true, roles, validationErrors.role_id)}
                {renderFormField('create-department-id', 'Department', newUser.department_id, (name, value) => {
                  handleInputChange(name, value);
                  setNewUser(prev => ({ ...prev, sub_department_id: '' }));
                  fetchSubDepartments(value);
                }, 'select', false, departments, validationErrors.department_id)}
                {renderFormField('create-sub-department-id', 'Sub Department', newUser.sub_department_id, handleInputChange, 'select', false, subDepartments, validationErrors.sub_department_id)}
                {renderFormField('create-designation', 'Designation', newUser.designation, handleInputChange, 'text', false, null, validationErrors.designation, 'Enter job designation')}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-reporting"
                    checked={newUser.is_reporting}
                    onCheckedChange={(checked) => handleInputChange('is_reporting', checked)}
                  />
                  <Label htmlFor="create-reporting" className="text-sm">Is Reporting Manager</Label>
                </div>

                {renderFormField('create-reporting-to', 'Reporting To', newUser.reporting_to, handleInputChange, 'select', false, activeUsers, validationErrors.reporting_to)}
                {renderFormField('create-region', 'Region', newUser.region, handleInputChange, 'select', false, regionOptions, validationErrors.region)}

                <div>
                  <Label htmlFor="create-business-verticals">Business Verticals</Label>
                  <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                    {businessVerticals.map((vertical) => (
                      <div key={vertical.id} className="flex items-center space-x-2 py-1">
                        <Checkbox
                          id={`vertical-${vertical.id}`}
                          checked={newUser.business_verticals.includes(vertical.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleInputChange('business_verticals', [...newUser.business_verticals, vertical.id]);
                            } else {
                              handleInputChange('business_verticals', newUser.business_verticals.filter(id => id !== vertical.id));
                            }
                          }}
                        />
                        <Label htmlFor={`vertical-${vertical.id}`} className="text-sm">
                          {vertical.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {renderFormField('create-address', 'Address', newUser.address, handleInputChange, 'textarea', false, null, validationErrors.address, 'Enter full address')}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderFormField('edit-name', 'Name', selectedUser.name, handleInputChange, 'text', true, null, validationErrors.name, 'Enter display name')}
                  {renderFormField('edit-full-name', 'Full Name', selectedUser.full_name, handleInputChange, 'text', false, null, validationErrors.full_name, 'Enter full legal name')}
                  {renderFormField('edit-username', 'Username', selectedUser.username, handleInputChange, 'text', false, null, validationErrors.username, 'Enter username (no spaces)')}
                  {renderFormField('edit-email', 'Email', selectedUser.email, handleInputChange, 'email', true, null, validationErrors.email, 'Enter email address')}
                  {renderFormField('edit-password', 'Password', selectedUser.password, handleInputChange, 'password', false, null, validationErrors.password, 'Enter new password (optional)')}
                  {renderFormField('edit-contact-no', 'Contact Number', selectedUser.contact_no, handleInputChange, 'text', false, null, validationErrors.contact_no, 'Enter contact number (digits only)')}
                  {renderFormField('edit-gender', 'Gender', selectedUser.gender, handleInputChange, 'select', false, genderOptions, validationErrors.gender)}
                  {renderFormField('edit-dob', 'Date of Birth', selectedUser.dob ? selectedUser.dob.split('T')[0] : '', handleInputChange, 'date', false, null, validationErrors.dob)}

                  {/* Profile Photo Upload */}
                  <div>
                    <Label htmlFor="edit-photo">Profile Photo</Label>
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {profilePhotoPreview ? (
                            <img src={profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-8 w-8 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <Input
                            id="edit-photo"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => document.getElementById('edit-photo').click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Change Photo
                          </Button>
                          <p className="text-xs text-gray-500 mt-1">Max 5MB, JPEG/PNG/GIF/WebP</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Professional Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Professional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderFormField('edit-role-id', 'Role', selectedUser.role_id, handleInputChange, 'select', true, roles, validationErrors.role_id)}
                  {renderFormField('edit-department-id', 'Department', selectedUser.department_id, (name, value) => {
                    handleInputChange(name, value);
                    setSelectedUser(prev => ({ ...prev, sub_department_id: '' }));
                    fetchSubDepartments(value);
                  }, 'select', false, departments, validationErrors.department_id)}
                  {renderFormField('edit-sub-department-id', 'Sub Department', selectedUser.sub_department_id, handleInputChange, 'select', false, subDepartments, validationErrors.sub_department_id)}
                  {renderFormField('edit-designation', 'Designation', selectedUser.designation, handleInputChange, 'text', false, null, validationErrors.designation, 'Enter job designation')}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-reporting"
                      checked={selectedUser.is_reporting || false}
                      onCheckedChange={(checked) => handleInputChange('is_reporting', checked)}
                    />
                    <Label htmlFor="edit-reporting" className="text-sm">Is Reporting Manager</Label>
                  </div>

                  {renderFormField('edit-reporting-to', 'Reporting To', selectedUser.reporting_to, handleInputChange, 'select', false, activeUsers.filter(user => user.id !== selectedUser.id), validationErrors.reporting_to)}
                  {renderFormField('edit-region', 'Region', selectedUser.region, handleInputChange, 'select', false, regionOptions, validationErrors.region)}

                  <div>
                    <Label htmlFor="edit-business-verticals">Business Verticals</Label>
                    <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                      {businessVerticals.map((vertical) => (
                        <div key={vertical.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`edit-vertical-${vertical.id}`}
                            checked={selectedUser.business_verticals?.includes(vertical.id) || false}
                            onCheckedChange={(checked) => {
                              const currentVerticals = selectedUser.business_verticals || [];
                              if (checked) {
                                handleInputChange('business_verticals', [...currentVerticals, vertical.id]);
                              } else {
                                handleInputChange('business_verticals', currentVerticals.filter(id => id !== vertical.id));
                              }
                            }}
                          />
                          <Label htmlFor={`edit-vertical-${vertical.id}`} className="text-sm">
                            {vertical.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {renderFormField('edit-address', 'Address', selectedUser.address, handleInputChange, 'textarea', false, null, validationErrors.address, 'Enter full address')}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              View User Details
            </DialogTitle>
            <DialogDescription>Complete user information</DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedUser.profile_photo && (
                    <div className="flex justify-center mb-4">
                      <img 
                        src={`${BACKEND_URL}${selectedUser.profile_photo}`} 
                        alt="Profile" 
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    </div>
                  )}
                  <div><strong>Name:</strong> {selectedUser.name}</div>
                  <div><strong>Full Name:</strong> {selectedUser.full_name || 'Not provided'}</div>
                  <div><strong>Username:</strong> {selectedUser.username || 'Not set'}</div>
                  <div><strong>Email:</strong> {selectedUser.email}</div>
                  <div><strong>Contact:</strong> {selectedUser.contact_no || 'Not provided'}</div>
                  <div><strong>Gender:</strong> {selectedUser.gender || 'Not specified'}</div>
                  <div><strong>Date of Birth:</strong> {selectedUser.dob ? new Date(selectedUser.dob).toLocaleDateString() : 'Not provided'}</div>
                  <div><strong>Address:</strong> {selectedUser.address || 'Not provided'}</div>
                </CardContent>
              </Card>

              {/* Professional Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Professional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div><strong>Role:</strong> <Badge variant="secondary">{getRoleName(selectedUser.role_id)}</Badge></div>
                  <div><strong>Department:</strong> {getDepartmentName(selectedUser.department_id)}</div>
                  <div><strong>Designation:</strong> {selectedUser.designation || 'Not assigned'}</div>
                  <div><strong>Region:</strong> {selectedUser.region || 'Not assigned'}</div>
                  <div><strong>Is Reporting Manager:</strong> {selectedUser.is_reporting ? 'Yes' : 'No'}</div>
                  <div><strong>Reporting To:</strong> {selectedUser.reporting_to_name || 'None'}</div>
                  <div><strong>Business Verticals:</strong> {getBusinessVerticalNames(selectedUser.business_verticals)}</div>
                  <div><strong>Status:</strong> 
                    <Badge className={selectedUser.is_active ? "bg-green-100 text-green-800 ml-2" : "bg-red-100 text-red-800 ml-2"}>
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div><strong>Created:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</div>
                </CardContent>
              </Card>
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

export default UserManagementFixed;