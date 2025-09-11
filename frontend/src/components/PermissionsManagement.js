import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Import shadcn components
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from '../hooks/use-toast';

// Icons
import { Shield, Plus, Edit, Trash2, Key } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PermissionsManagement = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await axios.get(`${API}/permissions`);
      if (response.data.success) {
        setPermissions(response.data.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePermission = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Permission name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(`${API}/permissions`, formData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Permission created successfully",
        });
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '' });
        fetchPermissions();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create permission",
        variant: "destructive",
      });
    }
  };

  const handleEditPermission = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Permission name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.put(`${API}/permissions/${selectedPermission.id}`, formData);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Permission updated successfully",
        });
        setIsEditDialogOpen(false);
        setSelectedPermission(null);
        setFormData({ name: '', description: '' });
        fetchPermissions();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  const handleDeletePermission = async () => {
    try {
      const response = await axios.delete(`${API}/permissions/${selectedPermission.id}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Permission deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        setSelectedPermission(null);
        fetchPermissions();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete permission",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (permission) => {
    setSelectedPermission(permission);
    setFormData({
      name: permission.name,
      description: permission.description || ''
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (permission) => {
    setSelectedPermission(permission);
    setIsDeleteDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Permissions Management</h2>
          <p className="text-slate-600">Manage system permissions and access controls</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Permission
        </Button>
      </div>

      {/* Permissions Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Permissions</p>
                <p className="text-3xl font-bold text-slate-900">{permissions.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Key className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">System Permissions</p>
                <p className="text-3xl font-bold text-slate-900">
                  {permissions.filter(p => ['view', 'create', 'edit', 'delete'].includes(p.name.toLowerCase())).length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Custom Permissions</p>
                <p className="text-3xl font-bold text-slate-900">
                  {permissions.filter(p => !['view', 'create', 'edit', 'delete'].includes(p.name.toLowerCase())).length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <Key className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>System Permissions</CardTitle>
          <CardDescription>
            Manage all system permissions that can be assigned to roles
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Key className="h-4 w-4 text-slate-500" />
                      <span>{permission.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{permission.description || 'No description'}</TableCell>
                  <TableCell>
                    <Badge 
                      className={
                        ['view', 'create', 'edit', 'delete'].includes(permission.name.toLowerCase())
                          ? "bg-green-100 text-green-800"
                          : "bg-purple-100 text-purple-800"
                      }
                    >
                      {['view', 'create', 'edit', 'delete'].includes(permission.name.toLowerCase()) 
                        ? 'System' 
                        : 'Custom'
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(permission)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-800"
                        onClick={() => openDeleteDialog(permission)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Permission Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Permission</DialogTitle>
            <DialogDescription>Add a new permission to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Permission Name *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., manage_reports, view_analytics"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use lowercase letters and underscores only
              </p>
            </div>
            <div>
              <Label htmlFor="create-description">Description</Label>
              <Input
                id="create-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this permission allows"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePermission} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Permission Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>Update permission information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Permission Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., manage_reports, view_analytics"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this permission allows"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditPermission} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Permission Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Permission</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the permission "{selectedPermission?.name}"? 
              This action cannot be undone and will remove it from all roles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeletePermission} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Permission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionsManagement;