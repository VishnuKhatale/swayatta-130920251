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

const UserManagement = () => {
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, deptsRes, verticalsRes, activeUsersRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/roles`),
        axios.get(`${API}/departments`),
        axios.get(`${API}/business-verticals`),
        axios.get(`${API}/users/active`)
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
      const response = await axios.get(`${API}/departments/${departmentId}/sub-departments`);
      if (response.data.success) {
        setSubDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch sub-departments:', error);
      setSubDepartments([]);
    }
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
      const response = await axios.post(`${API}/upload/profile-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
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

  const handleCreateUser = async () => {
    try {
      let userData = { ...newUser };
      
      // Upload profile photo if selected
      if (selectedFile) {
        const photoPath = await uploadProfilePhoto();
        if (photoPath) {
          userData.profile_photo = photoPath;
        }
      }

      const response = await axios.post(`${API}/users`, userData);
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
    try {
      let userData = { ...selectedUser };
      
      // Upload new profile photo if selected
      if (selectedFile) {
        const photoPath = await uploadProfilePhoto();
        if (photoPath) {
          userData.profile_photo = photoPath;
        }
      }

      const response = await axios.put(`${API}/users/${userData.id}`, userData);
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
        const response = await axios.delete(`${API}/users/${userId}`);
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
  };

  const openEditDialog = (user) => {
    setSelectedUser({ ...user });
    setProfilePhotoPreview(user.profile_photo ? `${BACKEND_URL}${user.profile_photo}` : '');
    fetchSubDepartments(user.department_id);
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
                <div>
                  <Label htmlFor="create-name">Name *</Label>
                  <Input
                    id="create-name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Enter display name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="create-full-name">Full Name</Label>
                  <Input
                    id="create-full-name"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    placeholder="Enter full legal name"
                  />
                </div>

                <div>
                  <Label htmlFor="create-username">Username</Label>
                  <Input
                    id="create-username"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Enter username (no spaces)"
                  />
                </div>

                <div>
                  <Label htmlFor="create-email">Email *</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <Label htmlFor="create-password">Password *</Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <Label htmlFor="create-contact">Contact Number</Label>
                  <Input
                    id="create-contact"
                    value={newUser.contact_no}
                    onChange={(e) => setNewUser({ ...newUser, contact_no: e.target.value })}
                    placeholder="Enter contact number (digits only)"
                  />
                </div>

                <div>
                  <Label htmlFor="create-gender">Gender</Label>
                  <Select value={newUser.gender} onValueChange={(value) => setNewUser({ ...newUser, gender: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="create-dob">Date of Birth</Label>
                  <Input
                    id="create-dob"
                    type="date"
                    value={newUser.dob}
                    onChange={(e) => setNewUser({ ...newUser, dob: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

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
                <div>
                  <Label htmlFor="create-role">Role *</Label>
                  <Select value={newUser.role_id} onValueChange={(value) => setNewUser({ ...newUser, role_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="create-department">Department</Label>
                  <Select 
                    value={newUser.department_id} 
                    onValueChange={(value) => {
                      setNewUser({ ...newUser, department_id: value, sub_department_id: '' });
                      fetchSubDepartments(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="create-sub-department">Sub Department</Label>
                  <Select 
                    value={newUser.sub_department_id} 
                    onValueChange={(value) => setNewUser({ ...newUser, sub_department_id: value })}
                    disabled={!newUser.department_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a sub-department" />
                    </SelectTrigger>
                    <SelectContent>
                      {subDepartments.map((subDept) => (
                        <SelectItem key={subDept.id} value={subDept.id}>
                          {subDept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="create-designation">Designation</Label>
                  <Input
                    id="create-designation"
                    value={newUser.designation}
                    onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                    placeholder="Enter job designation"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-reporting"
                    checked={newUser.is_reporting}
                    onCheckedChange={(checked) => setNewUser({ ...newUser, is_reporting: checked })}
                  />
                  <Label htmlFor="create-reporting" className="text-sm">Is Reporting Manager</Label>
                </div>

                <div>
                  <Label htmlFor="create-reporting-to">Reporting To</Label>
                  <Select 
                    value={newUser.reporting_to} 
                    onValueChange={(value) => setNewUser({ ...newUser, reporting_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reporting manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.name} ({user.designation || 'No designation'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="create-region">Region</Label>
                  <Select value={newUser.region} onValueChange={(value) => setNewUser({ ...newUser, region: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="North">North</SelectItem>
                      <SelectItem value="South">South</SelectItem>
                      <SelectItem value="East">East</SelectItem>
                      <SelectItem value="West">West</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                              setNewUser({
                                ...newUser,
                                business_verticals: [...newUser.business_verticals, vertical.id]
                              });
                            } else {
                              setNewUser({
                                ...newUser,
                                business_verticals: newUser.business_verticals.filter(id => id !== vertical.id)
                              });
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

                <div>
                  <Label htmlFor="create-address">Address</Label>
                  <Textarea
                    id="create-address"
                    value={newUser.address}
                    onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                    placeholder="Enter full address"
                    rows={3}
                  />
                </div>
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
                  <div>
                    <Label htmlFor="edit-name">Name *</Label>
                    <Input
                      id="edit-name"
                      value={selectedUser.name || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                      placeholder="Enter display name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-full-name">Full Name</Label>
                    <Input
                      id="edit-full-name"
                      value={selectedUser.full_name || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                      placeholder="Enter full legal name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-username">Username</Label>
                    <Input
                      id="edit-username"
                      value={selectedUser.username || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                      placeholder="Enter username (no spaces)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-email">Email *</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={selectedUser.email || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-password">Password (leave empty to keep current)</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      value={selectedUser.password || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })}
                      placeholder="Enter new password (optional)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-contact">Contact Number</Label>
                    <Input
                      id="edit-contact"
                      value={selectedUser.contact_no || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, contact_no: e.target.value })}
                      placeholder="Enter contact number (digits only)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-gender">Gender</Label>
                    <Select value={selectedUser.gender || ''} onValueChange={(value) => setSelectedUser({ ...selectedUser, gender: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-dob">Date of Birth</Label>
                    <Input
                      id="edit-dob"
                      type="date"
                      value={selectedUser.dob ? selectedUser.dob.split('T')[0] : ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, dob: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>

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
                  <div>
                    <Label htmlFor="edit-role">Role *</Label>
                    <Select value={selectedUser.role_id || ''} onValueChange={(value) => setSelectedUser({ ...selectedUser, role_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-department">Department</Label>
                    <Select 
                      value={selectedUser.department_id || ''} 
                      onValueChange={(value) => {
                        setSelectedUser({ ...selectedUser, department_id: value, sub_department_id: '' });
                        fetchSubDepartments(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-sub-department">Sub Department</Label>
                    <Select 
                      value={selectedUser.sub_department_id || ''} 
                      onValueChange={(value) => setSelectedUser({ ...selectedUser, sub_department_id: value })}
                      disabled={!selectedUser.department_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sub-department" />
                      </SelectTrigger>
                      <SelectContent>
                        {subDepartments.map((subDept) => (
                          <SelectItem key={subDept.id} value={subDept.id}>
                            {subDept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-designation">Designation</Label>
                    <Input
                      id="edit-designation"
                      value={selectedUser.designation || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, designation: e.target.value })}
                      placeholder="Enter job designation"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-reporting"
                      checked={selectedUser.is_reporting || false}
                      onCheckedChange={(checked) => setSelectedUser({ ...selectedUser, is_reporting: checked })}
                    />
                    <Label htmlFor="edit-reporting" className="text-sm">Is Reporting Manager</Label>
                  </div>

                  <div>
                    <Label htmlFor="edit-reporting-to">Reporting To</Label>
                    <Select 
                      value={selectedUser.reporting_to || ''} 
                      onValueChange={(value) => setSelectedUser({ ...selectedUser, reporting_to: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reporting manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeUsers.filter(user => user.id !== selectedUser.id).map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.name} ({user.designation || 'No designation'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-region">Region</Label>
                    <Select value={selectedUser.region || ''} onValueChange={(value) => setSelectedUser({ ...selectedUser, region: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="North">North</SelectItem>
                        <SelectItem value="South">South</SelectItem>
                        <SelectItem value="East">East</SelectItem>
                        <SelectItem value="West">West</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

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
                                setSelectedUser({
                                  ...selectedUser,
                                  business_verticals: [...currentVerticals, vertical.id]
                                });
                              } else {
                                setSelectedUser({
                                  ...selectedUser,
                                  business_verticals: currentVerticals.filter(id => id !== vertical.id)
                                });
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

                  <div>
                    <Label htmlFor="edit-address">Address</Label>
                    <Textarea
                      id="edit-address"
                      value={selectedUser.address || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, address: e.target.value })}
                      placeholder="Enter full address"
                      rows={3}
                    />
                  </div>
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

export default UserManagement;