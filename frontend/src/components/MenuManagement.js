import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Import shadcn components
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '../hooks/use-toast';

// Icons
import { Menu, Plus, Edit, Trash2, Eye, Settings, Folder, FolderOpen } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MenuManagement = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    parent_id: 'root'
  });
  const [stats, setStats] = useState({
    totalMenus: 0,
    parentMenus: 0,
    childMenus: 0,
    activeMenus: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const response = await axios.get(`${API}/menus`);
      if (response.data.success) {
        const menusData = response.data.data;
        setMenus(menusData);
        
        // Calculate statistics
        const totalMenus = menusData.length;
        const parentMenus = menusData.filter(menu => !menu.parent_id).length;
        const childMenus = menusData.filter(menu => menu.parent_id).length;
        const activeMenus = menusData.filter(menu => menu.is_active).length;
        
        setStats({
          totalMenus,
          parentMenus,
          childMenus,
          activeMenus
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch menus",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMenu = async () => {
    if (!formData.name.trim() || !formData.path.trim()) {
      toast({
        title: "Validation Error",
        description: "Menu name and path are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const menuPayload = {
        name: formData.name,
        path: formData.path,
        parent_id: formData.parent_id === 'root' ? null : formData.parent_id || null
      };

      const response = await axios.post(`${API}/menus`, menuPayload);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Menu created successfully",
        });
        setIsCreateDialogOpen(false);
        setFormData({ name: '', path: '', parent_id: 'root' });
        fetchMenus();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create menu",
        variant: "destructive",
      });
    }
  };

  const handleEditMenu = async () => {
    if (!formData.name.trim() || !formData.path.trim()) {
      toast({
        title: "Validation Error",
        description: "Menu name and path are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const menuPayload = {
        name: formData.name,
        path: formData.path,
        parent_id: formData.parent_id === 'root' ? null : formData.parent_id || null
      };

      const response = await axios.put(`${API}/menus/${selectedMenu.id}`, menuPayload);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Menu updated successfully",
        });
        setIsEditDialogOpen(false);
        setSelectedMenu(null);
        setFormData({ name: '', path: '', parent_id: 'root' });
        fetchMenus();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update menu",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMenu = async () => {
    try {
      const response = await axios.delete(`${API}/menus/${selectedMenu.id}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Menu deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        setSelectedMenu(null);
        fetchMenus();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete menu",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (menu) => {
    setSelectedMenu(menu);
    setFormData({
      name: menu.name,
      path: menu.path,
      parent_id: menu.parent_id || 'root'
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (menu) => {
    setSelectedMenu(menu);
    setIsDeleteDialogOpen(true);
  };

  const getParentMenus = () => {
    return menus.filter(menu => !menu.parent_id);
  };

  const getParentName = (parentId) => {
    if (!parentId) return 'Root Level';
    const parent = menus.find(menu => menu.id === parentId);
    return parent ? parent.name : 'Unknown';
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Menu Management</h2>
          <p className="text-slate-600">Manage system navigation menus and hierarchy</p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Menu
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menus">Menu List</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Total Menus</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.totalMenus}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
                    <Menu className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Parent Menus</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.parentMenus}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <Folder className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Child Menus</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.childMenus}</p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-100">
                    <FolderOpen className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">Active Menus</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.activeMenus}</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100">
                    <Settings className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Summary */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Menu System Overview</CardTitle>
              <CardDescription>Current state of your navigation menu structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">System Status</span>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Menu Hierarchy</span>
                <span className="text-sm text-slate-900">{stats.parentMenus} levels</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Navigation Items</span>
                <span className="text-sm text-slate-900">{stats.totalMenus} items</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menus" className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menus.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          {menu.parent_id ? (
                            <span className="mr-2 text-slate-400">└─</span>
                          ) : (
                            <Folder className="mr-2 h-4 w-4 text-blue-600" />
                          )}
                          {menu.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{menu.path}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getParentName(menu.parent_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={menu.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {menu.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(menu.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(menu)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-800"
                            onClick={() => openDeleteDialog(menu)}
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
        </TabsContent>
      </Tabs>

      {/* Create Menu Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Menu</DialogTitle>
            <DialogDescription>Add a new menu item to the system navigation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-name">Menu Name *</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter menu name"
              />
            </div>
            <div>
              <Label htmlFor="create-path">Menu Path *</Label>
              <Input
                id="create-path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="e.g., /dashboard, /users"
              />
            </div>
            <div>
              <Label htmlFor="create-parent">Parent Menu</Label>
              <Select value={formData.parent_id} onValueChange={(value) => setFormData({ ...formData, parent_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">No Parent (Root Level)</SelectItem>
                  {getParentMenus().map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMenu} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Menu Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu</DialogTitle>
            <DialogDescription>Update menu information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Menu Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter menu name"
              />
            </div>
            <div>
              <Label htmlFor="edit-path">Menu Path *</Label>
              <Input
                id="edit-path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="e.g., /dashboard, /users"
              />
            </div>
            <div>
              <Label htmlFor="edit-parent">Parent Menu</Label>
              <Select value={formData.parent_id} onValueChange={(value) => setFormData({ ...formData, parent_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">No Parent (Root Level)</SelectItem>
                  {getParentMenus().filter(menu => menu.id !== selectedMenu?.id).map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditMenu} className="bg-blue-600 hover:bg-blue-700 text-white">
              Update Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Menu Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Menu</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the menu "{selectedMenu?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDeleteMenu} 
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuManagement;