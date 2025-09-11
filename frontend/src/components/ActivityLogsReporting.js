import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Import shadcn components
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '../hooks/use-toast';

// Icons
import { Activity, Download, Filter, Calendar, Users, BarChart3, TrendingUp, Eye, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ActivityLogsReporting = () => {
  const [activityLogs, setActivityLogs] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState({
    activity: false,
    login: false,
    analytics: false,
    export: false
  });
  
  // Pagination state
  const [activityPagination, setActivityPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 50
  });
  
  const [loginPagination, setLoginPagination] = useState({
    current_page: 1,  
    total_pages: 1,
    total_items: 0,
    items_per_page: 50
  });
  
  // Filter state
  const [activityFilters, setActivityFilters] = useState({
    user_id: 'all',
    action_filter: '',
    start_date: '',
    end_date: '',
    page: 1
  });
  
  const [loginFilters, setLoginFilters] = useState({
    user_id: 'all',
    start_date: '',
    end_date: '',
    page: 1
  });
  
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchActivityLogs();
    fetchLoginLogs();
    fetchAnalytics();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchActivityLogs = async (filters = activityFilters) => {
    setLoading(prev => ({ ...prev, activity: true }));
    try {
      const params = new URLSearchParams();
      if (filters.user_id && filters.user_id !== 'all') params.append('user_id', filters.user_id);
      if (filters.action_filter) params.append('action_filter', filters.action_filter);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('page', filters.page);
      params.append('limit', '50');
      
      const response = await axios.get(`${API}/logs/activity?${params}`);
      if (response.data.success) {
        setActivityLogs(response.data.data.logs);
        setActivityPagination(response.data.data.pagination);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch activity logs",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, activity: false }));
    }
  };

  const fetchLoginLogs = async (filters = loginFilters) => {
    setLoading(prev => ({ ...prev, login: true }));
    try {
      const params = new URLSearchParams();
      if (filters.user_id && filters.user_id !== 'all') params.append('user_id', filters.user_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('page', filters.page);
      params.append('limit', '50');
      
      const response = await axios.get(`${API}/logs/login?${params}`);
      if (response.data.success) {
        setLoginLogs(response.data.data.logs);
        setLoginPagination(response.data.data.pagination);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch login logs",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, login: false }));
    }
  };

  const fetchAnalytics = async (days = 30) => {
    setLoading(prev => ({ ...prev, analytics: true }));
    try {
      const response = await axios.get(`${API}/logs/analytics?days=${days}`);
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, analytics: false }));
    }
  };

  const handleActivityFilterChange = (key, value) => {
    const newFilters = { ...activityFilters, [key]: value, page: 1 };
    setActivityFilters(newFilters);
  };

  const handleLoginFilterChange = (key, value) => {
    const newFilters = { ...loginFilters, [key]: value, page: 1 };
    setLoginFilters(newFilters);
  };

  const applyActivityFilters = () => {
    fetchActivityLogs(activityFilters);
  };

  const applyLoginFilters = () => {
    fetchLoginLogs(loginFilters);
  };

  const clearActivityFilters = () => {
    const clearedFilters = {
      user_id: 'all',
      action_filter: '',
      start_date: '',
      end_date: '',
      page: 1
    };
    setActivityFilters(clearedFilters);
    fetchActivityLogs(clearedFilters);
  };

  const clearLoginFilters = () => {
    const clearedFilters = {
      user_id: 'all',
      start_date: '',
      end_date: '',
      page: 1
    };
    setLoginFilters(clearedFilters);
    fetchLoginLogs(clearedFilters);
  };

  const handlePageChange = (type, newPage) => {
    if (type === 'activity') {
      const newFilters = { ...activityFilters, page: newPage };
      setActivityFilters(newFilters);
      fetchActivityLogs(newFilters);
    } else if (type === 'login') {
      const newFilters = { ...loginFilters, page: newPage };
      setLoginFilters(newFilters);
      fetchLoginLogs(newFilters);
    }
  };

  const exportActivityLogs = async () => {
    setLoading(prev => ({ ...prev, export: true }));
    try {
      const params = new URLSearchParams();
      if (activityFilters.user_id && activityFilters.user_id !== 'all') params.append('user_id', activityFilters.user_id);
      if (activityFilters.action_filter) params.append('action_filter', activityFilters.action_filter);
      if (activityFilters.start_date) params.append('start_date', activityFilters.start_date);
      if (activityFilters.end_date) params.append('end_date', activityFilters.end_date);
      params.append('format', 'csv');
      
      const response = await axios.get(`${API}/logs/export/activity?${params}`);
      if (response.data.success) {
        // Create and download the CSV file
        const blob = new Blob([response.data.data.content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: `Exported ${response.data.data.total_records} activity log records`,
        });
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to export activity logs",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown User';
  };

  if (loading.activity && loading.login && loading.analytics) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Activity & Login Logs</h2>
          <p className="text-slate-600">Monitor system activity and user login patterns</p>
        </div>
        <Button 
          onClick={exportActivityLogs}
          disabled={loading.export}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="mr-2 h-4 w-4" />
          {loading.export ? 'Exporting...' : 'Export Activity Logs'}
        </Button>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="login">Login Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Dashboard */}
          {analytics && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Total Activities</p>
                        <p className="text-3xl font-bold text-slate-900">{analytics.summary.total_activities}</p>
                      </div>
                      <div className="p-3 rounded-full bg-blue-100">
                        <Activity className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Total Logins</p>
                        <p className="text-3xl font-bold text-slate-900">{analytics.summary.total_logins}</p>
                      </div>
                      <div className="p-3 rounded-full bg-green-100">
                        <Users className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Active Users</p>
                        <p className="text-3xl font-bold text-slate-900">{analytics.summary.unique_active_users}</p>
                      </div>
                      <div className="p-3 rounded-full bg-purple-100">
                        <TrendingUp className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600">Date Range</p>
                        <p className="text-3xl font-bold text-slate-900">{analytics.summary.date_range_days}</p>
                        <p className="text-sm text-slate-500">days</p>
                      </div>
                      <div className="p-3 rounded-full bg-orange-100">
                        <Calendar className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Most Active Users */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Most Active Users (Last 30 Days)</CardTitle>
                  <CardDescription>Users with the highest activity count</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.most_active_users.slice(0, 10).map((user, index) => (
                      <div key={user.user_id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <span className="font-medium">{user.user_name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-blue-100 text-blue-800">
                            {user.activity_count} activities
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Analytics Controls */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Analytics Period</CardTitle>
                  <CardDescription>Adjust the time period for analytics data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-4">
                    <Button 
                      variant={analytics.summary.date_range_days === 7 ? "default" : "outline"}
                      onClick={() => fetchAnalytics(7)}
                    >
                      Last 7 Days
                    </Button>
                    <Button 
                      variant={analytics.summary.date_range_days === 30 ? "default" : "outline"}
                      onClick={() => fetchAnalytics(30)}
                    >
                      Last 30 Days
                    </Button>
                    <Button 
                      variant={analytics.summary.date_range_days === 90 ? "default" : "outline"}
                      onClick={() => fetchAnalytics(90)}
                    >
                      Last 90 Days
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          {/* Activity Logs Filters */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Activity Logs Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="activity-user">User</Label>
                  <Select value={activityFilters.user_id} onValueChange={(value) => handleActivityFilterChange('user_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="activity-action">Action Filter</Label>
                  <Input
                    id="activity-action"
                    value={activityFilters.action_filter}
                    onChange={(e) => handleActivityFilterChange('action_filter', e.target.value)}
                    placeholder="Search actions..."
                  />
                </div>
                <div>
                  <Label htmlFor="activity-start">Start Date</Label>
                  <Input
                    id="activity-start"
                    type="datetime-local"
                    value={activityFilters.start_date}
                    onChange={(e) => handleActivityFilterChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="activity-end">End Date</Label>
                  <Input
                    id="activity-end"
                    type="datetime-local"
                    value={activityFilters.end_date}
                    onChange={(e) => handleActivityFilterChange('end_date', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button onClick={applyActivityFilters}>Apply Filters</Button>
                <Button variant="outline" onClick={clearActivityFilters}>Clear Filters</Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity Logs Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Activity Logs</CardTitle>
                  <CardDescription>
                    Showing {activityPagination.total_items} total activities
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading.activity ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : activityLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">No activity logs found</TableCell>
                    </TableRow>
                  ) : (
                    activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4 text-slate-400" />
                            {formatDateTime(log.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.user_name}</div>
                            <div className="text-sm text-slate-500">{log.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Activity Pagination */}
          {activityPagination.total_pages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                disabled={activityPagination.current_page === 1}
                onClick={() => handlePageChange('activity', activityPagination.current_page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {activityPagination.current_page} of {activityPagination.total_pages}
              </span>
              <Button
                variant="outline"
                disabled={activityPagination.current_page === activityPagination.total_pages}
                onClick={() => handlePageChange('activity', activityPagination.current_page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="login" className="space-y-6">
          {/* Login Logs Filters */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5" />
                Login Logs Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="login-user">User</Label>
                  <Select value={loginFilters.user_id} onValueChange={(value) => handleLoginFilterChange('user_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="login-start">Start Date</Label>
                  <Input
                    id="login-start"
                    type="datetime-local"
                    value={loginFilters.start_date}
                    onChange={(e) => handleLoginFilterChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="login-end">End Date</Label>
                  <Input
                    id="login-end"
                    type="datetime-local"
                    value={loginFilters.end_date}
                    onChange={(e) => handleLoginFilterChange('end_date', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button onClick={applyLoginFilters}>Apply Filters</Button>
                <Button variant="outline" onClick={clearLoginFilters}>Clear Filters</Button>
              </div>
            </CardContent>
          </Card>

          {/* Login Logs Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Login Logs</CardTitle>
                  <CardDescription>
                    Showing {loginPagination.total_items} total login records
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Login Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading.login ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : loginLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">No login logs found</TableCell>
                    </TableRow>
                  ) : (
                    loginLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4 text-slate-400" />
                            {formatDateTime(log.login_time)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.user_name}</div>
                            <div className="text-sm text-slate-500">{log.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {log.ip_address || 'Not recorded'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={log.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {log.is_active ? 'Success' : 'Failed'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Login Pagination */}
          {loginPagination.total_pages > 1 && (
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                disabled={loginPagination.current_page === 1}
                onClick={() => handlePageChange('login', loginPagination.current_page - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {loginPagination.current_page} of {loginPagination.total_pages}
              </span>
              <Button
                variant="outline"
                disabled={loginPagination.current_page === loginPagination.total_pages}
                onClick={() => handlePageChange('login', loginPagination.current_page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ActivityLogsReporting;