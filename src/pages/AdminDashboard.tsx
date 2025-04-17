
import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { getBookings, getCancellations, getAdminData } from '@/services/trainService';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import TrainForm from '@/components/admin/TrainForm';
import SqlQueryLogger from '@/components/admin/SqlQueryLogger';
import { Train, Users, CreditCard, PieChart, RefreshCcw } from 'lucide-react';
import { BookingData, CancellationData } from '@/types/railBooker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const { toast } = useToast();
  
  // Get bookings data
  const { 
    data: bookings, 
    isLoading: loadingBookings,
    refetch: refetchBookings
  } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: getBookings
  });
  
  // Get cancellations data
  const { 
    data: cancellations, 
    isLoading: loadingCancellations,
    refetch: refetchCancellations
  } = useQuery({
    queryKey: ['admin-cancellations'],
    queryFn: getCancellations
  });
  
  // Get admin data (revenue)
  const {
    data: adminData,
    isLoading: loadingAdminData,
    refetch: refetchAdminData
  } = useQuery({
    queryKey: ['admin-data'],
    queryFn: getAdminData
  });
  
  useEffect(() => {
    if (adminData) {
      setTotalRevenue(adminData.totalRevenue);
    }
  }, [adminData]);
  
  // Subscribe to real-time updates
  useEffect(() => {
    // Create channels for different tables
    const trainChannel = supabase
      .channel('public:train')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'train' },
        (payload) => {
          console.log('Train data updated:', payload);
          refetchBookings();
        }
      )
      .subscribe();
      
    const bookingChannel = supabase
      .channel('public:booking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking' },
        (payload) => {
          console.log('Booking data updated:', payload);
          refetchBookings();
        }
      )
      .subscribe();
      
    const cancellationChannel = supabase
      .channel('public:cancellation')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cancellation' },
        (payload) => {
          console.log('Cancellation data updated:', payload);
          refetchCancellations();
        }
      )
      .subscribe();
      
    const adminChannel = supabase
      .channel('public:admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin' },
        (payload) => {
          console.log('Admin data updated:', payload);
          refetchAdminData();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(trainChannel);
      supabase.removeChannel(bookingChannel);
      supabase.removeChannel(cancellationChannel);
      supabase.removeChannel(adminChannel);
    };
  }, [refetchBookings, refetchCancellations, refetchAdminData]);
  
  const handleRefreshData = () => {
    toast({
      title: "Refreshing data...",
      description: "Fetching the latest data from the database."
    });
    
    refetchBookings();
    refetchCancellations();
    refetchAdminData();
  };
  
  // Calculate statistics
  const confirmedBookings = bookings?.filter(booking => booking.booking_status === 'Confirmed') || [];
  const cancelledBookings = bookings?.filter(booking => booking.booking_status === 'Cancelled') || [];
  
  // Prepare chart data
  const classBookingCounts: Record<string, number> = {};
  confirmedBookings.forEach(booking => {
    classBookingCounts[booking.class] = (classBookingCounts[booking.class] || 0) + 1;
  });
  
  const bookingChartData = Object.keys(classBookingCounts).map(classType => ({
    name: classType,
    bookings: classBookingCounts[classType]
  }));
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 flex-grow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-railway-800">Admin Dashboard</h1>
          <Button 
            onClick={handleRefreshData} 
            variant="outline" 
            className="flex items-center gap-2 hover:bg-railway-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh Data
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2 py-3">
              <PieChart className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2 py-3">
              <Users className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="trains" className="flex items-center gap-2 py-3">
              <Train className="h-4 w-4" />
              Manage Trains
            </TabsTrigger>
            <TabsTrigger value="sql" className="flex items-center gap-2 py-3">
              <CreditCard className="h-4 w-4" />
              SQL Logger
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="bg-gradient-to-r from-railway-50 to-white pb-2">
                  <CardTitle className="text-lg">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">₹{totalRevenue.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 mt-1">From all bookings</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="bg-gradient-to-r from-railway-50 to-white pb-2">
                  <CardTitle className="text-lg">Active Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{confirmedBookings.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Confirmed tickets</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="bg-gradient-to-r from-railway-50 to-white pb-2">
                  <CardTitle className="text-lg">Total Passengers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{confirmedBookings.length + cancelledBookings.length}</p>
                  <p className="text-sm text-gray-500 mt-1">Across all bookings</p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                <CardTitle>Bookings by Class</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bookingChartData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [`${value} bookings`, 'Bookings']}
                        labelFormatter={(label) => `Class: ${label}`}
                      />
                      <Bar dataKey="bookings" fill="#4f46e5" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="bookings">
            <Card>
              <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                <CardTitle>Booking Management</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingBookings ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-railway-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PNR</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Train</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bookings && bookings.length > 0 ? (
                          bookings.map((booking: BookingData) => (
                            <tr key={booking.pnr} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.pnr}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.passenger?.name || 'Unknown'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.train?.train_name || 'Unknown'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{booking.class}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  booking.booking_status === 'Confirmed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {booking.booking_status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(booking.booking_date).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">No bookings found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
                <CardTitle>Cancellation History</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingCancellations ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-railway-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PNR</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Refund Amount</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cancellations && cancellations.length > 0 ? (
                          cancellations.map((cancellation: CancellationData) => (
                            <tr key={cancellation.cancel_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cancellation.pnr}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{cancellation.refund_amount}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  cancellation.status === 'Processed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {cancellation.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(cancellation.cancellation_date).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No cancellations found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="trains">
            <TrainForm />
          </TabsContent>
          
          <TabsContent value="sql">
            <SqlQueryLogger />
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
    </div>
  );
};

export default AdminDashboard;
