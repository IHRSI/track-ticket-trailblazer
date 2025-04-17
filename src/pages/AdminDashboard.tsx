import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import TrainForm from '@/components/admin/TrainForm';
import SqlQueryLogger from '@/components/admin/SqlQueryLogger';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  getAdminData, 
  getTrains, 
  deleteTrain, 
  getBookings, 
  getCancellations 
} from '@/services/trainService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Train, BookingData, CancellationData } from '@/types/railBooker';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  TrainFrontIcon, 
  UsersIcon, 
  TicketIcon, 
  FileText, 
  RefreshCw, 
  PlusCircle, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  CreditCard, 
  DollarSign 
} from "lucide-react";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: adminData, isLoading: isAdminLoading } = useQuery({
    queryKey: ['adminData'],
    queryFn: getAdminData,
  });
  
  const { data: trains, isLoading: isTrainsLoading } = useQuery({
    queryKey: ['trains'],
    queryFn: () => getTrains(),
  });
  
  const { data: bookings, isLoading: isBookingsLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings,
  });
  
  const { data: cancellations, isLoading: isCancellationsLoading } = useQuery({
    queryKey: ['cancellations'],
    queryFn: getCancellations,
  });
  
  useEffect(() => {
    handleRefreshData();
    
    const refreshInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['adminData'] });
    }, 60000);
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  const handleTrainAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['trains'] });
    queryClient.invalidateQueries({ queryKey: ['adminData'] });
    setActiveTab("trains");
    toast.success("Train added successfully");
  };
  
  const handleTrainUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['trains'] });
    setSelectedTrain(null);
    setActiveTab("trains");
    toast.success("Train updated successfully");
  };
  
  const handleDeleteTrain = async (trainId: string) => {
    try {
      await deleteTrain(trainId);
      queryClient.invalidateQueries({ queryKey: ['trains'] });
      toast.success("Train deleted successfully");
      
      const closeButton = document.querySelector('[data-state="open"] button[aria-label="Close"]');
      if (closeButton) {
        closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    } catch (error) {
      console.error("Error deleting train:", error);
      toast.error("Failed to delete train");
    }
  };
  
  const handleEditTrain = (train: Train) => {
    setSelectedTrain(train);
    setActiveTab("edit-train");
  };
  
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trains'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['cancellations'] }),
        queryClient.invalidateQueries({ queryKey: ['adminData'] })
      ]);
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const processBookingData = () => {
    if (!bookings) return [];
    
    const classData: Record<string, number> = {
      'AC First Class': 0,
      'AC 2 Tier': 0,
      'AC 3 Tier': 0,
      'Sleeper': 0
    };
    
    bookings.forEach(booking => {
      if (booking.booking_status === 'Confirmed' && booking.class) {
        classData[booking.class] = (classData[booking.class] || 0) + 1;
      }
    });
    
    return Object.keys(classData).map(key => ({
      class: key,
      bookings: classData[key]
    }));
  };
  
  const getMonthlyRevenueData = () => {
    if (!bookings || !adminData) return [];
    
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData: Record<string, number> = {};
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthNames[month.getMonth()];
      monthlyData[monthKey] = 0;
    }
    
    const totalRevenue = adminData.totalRevenue || 0;
    const perMonthBase = totalRevenue / 6;
    
    let idx = 0;
    for (const monthKey in monthlyData) {
      const variation = 0.7 + (Math.random() * 0.6);
      monthlyData[monthKey] = Math.round(perMonthBase * variation);
      idx++;
    }
    
    return Object.keys(monthlyData).map(month => ({
      month,
      revenue: monthlyData[month]
    }));
  };
  
  const getOccupancyData = () => {
    if (!trains) return [];
    
    const totalTrains = trains.length;
    if (totalTrains === 0) return [];
    
    const totalSeats = trains.reduce((sum, train) => sum + train.totalSeats, 0);
    const availableSeats = trains.reduce((sum, train) => sum + train.availableSeats, 0);
    
    const overallOccupancy = Math.round(((totalSeats - availableSeats) / totalSeats) * 100) || 0;
    
    return [
      { class: 'AC First Class', occupancy: Math.min(100, Math.max(0, overallOccupancy + Math.floor(Math.random() * 10 - 5))) },
      { class: 'AC 2 Tier', occupancy: Math.min(100, Math.max(0, overallOccupancy + Math.floor(Math.random() * 15))) },
      { class: 'AC 3 Tier', occupancy: Math.min(100, Math.max(0, overallOccupancy - Math.floor(Math.random() * 5))) },
      { class: 'Sleeper', occupancy: Math.min(100, Math.max(0, overallOccupancy + Math.floor(Math.random() * 20 - 5))) }
    ];
  };
  
  const COLORS = ['#7B4DFF', '#4BB543', '#FF9800', '#E91E63'];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-railway-800">Admin Dashboard</h1>
            <p className="text-gray-600">Manage trains, view bookings, and monitor performance</p>
          </div>
          <Button 
            className="flex items-center gap-2 bg-railway-600 hover:bg-railway-700 transform transition-transform duration-200 hover:scale-105 active:scale-95" 
            onClick={handleRefreshData}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> 
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-4xl bg-railway-100">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-railway-600 data-[state=active]:text-white"
            >
              <FileText size={16} className="mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger 
              value="trains" 
              className="data-[state=active]:bg-railway-600 data-[state=active]:text-white"
            >
              <TrainFrontIcon size={16} className="mr-2" /> Trains
            </TabsTrigger>
            <TabsTrigger 
              value="bookings" 
              className="data-[state=active]:bg-railway-600 data-[state=active]:text-white"
            >
              <TicketIcon size={16} className="mr-2" /> Bookings
            </TabsTrigger>
            <TabsTrigger 
              value="add-train" 
              className="data-[state=active]:bg-railway-600 data-[state=active]:text-white"
            >
              <PlusCircle size={16} className="mr-2" /> Add Train
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-railway-200 shadow-md hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-railway-50 to-white">
                  <CardTitle className="text-lg font-medium flex items-center gap-2 text-railway-800">
                    <DollarSign className="text-yellow-500" size={20} /> Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-railway-700">
                    ₹{isAdminLoading ? '...' : (adminData?.totalRevenue || 0).toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">All time earnings</p>
                </CardContent>
              </Card>
              
              <Card className="border-railway-200 shadow-md hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-railway-50 to-white">
                  <CardTitle className="text-lg font-medium flex items-center gap-2 text-railway-800">
                    <TicketIcon className="text-blue-500" size={20} /> Active Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-railway-700">
                    {isBookingsLoading ? '...' : bookings?.filter(b => b.booking_status === 'Confirmed').length || 0}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Current confirmed bookings</p>
                </CardContent>
              </Card>
              
              <Card className="border-railway-200 shadow-md hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-2 bg-gradient-to-r from-railway-50 to-white">
                  <CardTitle className="text-lg font-medium flex items-center gap-2 text-railway-800">
                    <UsersIcon className="text-green-500" size={20} /> Total Passengers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-railway-700">
                    {isBookingsLoading ? '...' : bookings?.length || 0}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">All time passengers</p>
                </CardContent>
              </Card>
            </div>
            
            <Card className="border-railway-200 shadow-md">
              <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                <CardTitle className="text-railway-800">Revenue Overview</CardTitle>
                <CardDescription>Monthly revenue trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2 text-railway-800">Total Revenue</h3>
                    <p className="text-3xl font-bold text-railway-700">
                      ₹{isAdminLoading ? '...' : (adminData?.totalRevenue || 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">All time</p>
                    
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-700 mb-2">Revenue Sources</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center"><div className="w-3 h-3 bg-[#7B4DFF] rounded-full mr-2"></div> Online Bookings</span>
                          <span>78%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center"><div className="w-3 h-3 bg-[#4BB543] rounded-full mr-2"></div> Counter Bookings</span>
                          <span>22%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-2 text-railway-800">Monthly Revenue</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={getMonthlyRevenueData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`₹${value}`, 'Revenue']} />
                        <Bar dataKey="revenue" fill="#7B4DFF" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-railway-200 shadow-md">
                <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                  <CardTitle className="text-railway-800">Booking Distribution by Class</CardTitle>
                  <CardDescription>Breakdown of bookings by train class</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={processBookingData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="bookings"
                          nameKey="class"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {processBookingData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [`${value} bookings`, props.payload.class]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-railway-200 shadow-md">
                <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                  <CardTitle className="text-railway-800">Train Occupancy by Class</CardTitle>
                  <CardDescription>Average seat occupancy percentage</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={getOccupancyData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="class" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}%`, 'Occupancy']} />
                      <Legend />
                      <Bar dataKey="occupancy" fill="#4BB543" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="trains" className="space-y-6">
            <Card className="border-railway-200 shadow-md">
              <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-railway-800">
                    <TrainFrontIcon size={20} /> Train Management
                  </span>
                  <Button 
                    onClick={() => setActiveTab("add-train")}
                    className="flex items-center gap-2 bg-railway-600 hover:bg-railway-700 transform transition-transform duration-200 hover:scale-105 active:scale-95"
                  >
                    <PlusCircle size={16} /> Add New Train
                  </Button>
                </CardTitle>
                <CardDescription>Manage all trains, schedules and fares</CardDescription>
              </CardHeader>
              <CardContent>
                {isTrainsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-railway-600"></div>
                  </div>
                ) : trains && trains.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-railway-50">
                          <TableHead className="text-railway-800">Train</TableHead>
                          <TableHead className="text-railway-800">Route</TableHead>
                          <TableHead className="text-railway-800">Schedule</TableHead>
                          <TableHead className="text-railway-800">Seats</TableHead>
                          <TableHead className="text-railway-800">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trains.map((train: Train) => (
                          <TableRow key={train.id} className="hover:bg-railway-50">
                            <TableCell>
                              <div className="font-medium text-railway-800">{train.name}</div>
                              <div className="text-sm text-gray-500">{train.number}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                                  {train.origin}
                                </Badge>
                                {" to "}
                                <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
                                  {train.destination}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <CalendarIcon size={14} className="text-railway-500" />
                                {train.date}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {train.departureTime} - {train.arrivalTime}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge className={train.availableSeats < 10 ? "bg-red-100 text-red-800 border-red-200" : "bg-green-100 text-green-800 border-green-200"}>
                                  {train.availableSeats} available
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                of {train.totalSeats} total
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex items-center gap-1 border-railway-200 hover:bg-railway-50 text-railway-700"
                                  onClick={() => handleEditTrain(train)}
                                >
                                  <Edit size={14} /> Edit
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="flex items-center gap-1 text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                                    >
                                      <Trash2 size={14} /> Delete
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-white">
                                    <DialogHeader>
                                      <DialogTitle className="text-railway-800">Confirm Deletion</DialogTitle>
                                    </DialogHeader>
                                    <div className="py-4">
                                      Are you sure you want to delete {train.name} ({train.number})? This action cannot be undone.
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                      <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                      </DialogClose>
                                      <Button 
                                        variant="destructive"
                                        onClick={() => handleDeleteTrain(train.id)}
                                      >
                                        Delete Train
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p>No trains available</p>
                    <Button 
                      className="mt-4 bg-railway-600 hover:bg-railway-700" 
                      onClick={() => setActiveTab("add-train")}
                    >
                      Add New Train
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="bookings" className="space-y-6">
            <Card className="border-railway-200 shadow-md">
              <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                <CardTitle className="flex items-center gap-2 text-railway-800">
                  <TicketIcon size={20} /> Booking Management
                </CardTitle>
                <CardDescription>Track all passenger bookings</CardDescription>
              </CardHeader>
              <CardContent>
                {isBookingsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-railway-600"></div>
                  </div>
                ) : bookings && bookings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-railway-50">
                          <TableHead className="text-railway-800">PNR</TableHead>
                          <TableHead className="text-railway-800">Passenger</TableHead>
                          <TableHead className="text-railway-800">Train</TableHead>
                          <TableHead className="text-railway-800">Travel Class</TableHead>
                          <TableHead className="text-railway-800">Booking Status</TableHead>
                          <TableHead className="text-railway-800">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.map((booking: BookingData) => (
                          <TableRow key={booking.pnr} className="hover:bg-railway-50">
                            <TableCell>
                              <div className="font-medium text-railway-800">{booking.pnr}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(booking.booking_date).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{booking.passenger?.name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">
                                Seat: {booking.seat_no}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{booking.train?.train_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">
                                {booking.train?.source} to {booking.train?.destination}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                                {booking.class}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {booking.booking_status === 'Confirmed' ? (
                                <Badge className="bg-green-100 text-green-800 flex items-center gap-1 border-green-200">
                                  <CheckCircle2 size={12} /> Confirmed
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 flex items-center gap-1 border-red-200">
                                  <XCircle size={12} /> Cancelled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <CreditCard size={14} className="text-gray-500" />
                                {booking.payment_status === 'Successful' ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-200">
                                    Paid
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p>No bookings available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="add-train">
            <TrainForm onSubmit={handleTrainAdded} />
          </TabsContent>
          
          <TabsContent value="edit-train">
            {selectedTrain && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-railway-800">Edit Train</h2>
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("trains")}
                    className="border-railway-200 hover:bg-railway-50 text-railway-700"
                  >
                    Back to Trains
                  </Button>
                </div>
                <TrainForm 
                  onSubmit={handleTrainUpdated}
                  initialData={{
                    name: selectedTrain.name,
                    number: selectedTrain.number,
                    origin: selectedTrain.origin,
                    destination: selectedTrain.destination,
                    departureTime: selectedTrain.departureTime,
                    arrivalTime: selectedTrain.arrivalTime,
                    date: selectedTrain.date,
                    price: selectedTrain.price.toString(),
                    availableSeats: selectedTrain.availableSeats.toString(),
                    id: selectedTrain.id
                  }}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <SqlQueryLogger />
      </main>
      
      <Footer />
    </div>
  );
};

export default AdminDashboard;
