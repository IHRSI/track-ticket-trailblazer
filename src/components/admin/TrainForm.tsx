
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from 'sonner';
import { addTrain, updateTrain } from '@/services/trainService';

interface TrainFormProps {
  onSubmit: (trainData: any) => void;
  initialData?: {
    id?: string;
    name: string;
    number: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    date: string;
    price: string;
    availableSeats: string;
  };
}

const TrainForm: React.FC<TrainFormProps> = ({ onSubmit, initialData }) => {
  const [trainData, setTrainData] = useState({
    name: initialData?.name || '',
    number: initialData?.number || '',
    origin: initialData?.origin || '',
    destination: initialData?.destination || '',
    departureTime: initialData?.departureTime || '',
    arrivalTime: initialData?.arrivalTime || '',
    date: initialData?.date || '',
    price: initialData?.price || '',
    availableSeats: initialData?.availableSeats || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTrainData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Helper function to format time to ensure HH:MM format
  const formatTimeValue = (value: string): string => {
    // If already in HH:MM format, return as is
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      const [hours, minutes] = value.split(':').map(Number);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // Try to extract hours and minutes
    const timeParts = value.split(':');
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return value; // Return original if invalid
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    // If it's just a number, assume it's hours
    const hoursOnly = parseInt(value);
    if (!isNaN(hoursOnly) && hoursOnly >= 0 && hoursOnly < 24) {
      return `${hoursOnly.toString().padStart(2, '0')}:00`;
    }
    
    return value; // Return original if cannot format
  };

  const validateForm = () => {
    const requiredFields = [
      'name', 'number', 'origin', 'destination', 
      'departureTime', 'arrivalTime', 'date', 
      'price', 'availableSeats'
    ];
    
    for (const field of requiredFields) {
      if (!trainData[field]) {
        toast.error(`Please enter ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    // Format and validate departure time
    const formattedDepartureTime = formatTimeValue(trainData.departureTime);
    if (!timeRegex.test(formattedDepartureTime)) {
      toast.error("Departure time should be in HH:MM format (e.g. 08:30)");
      return false;
    }
    
    // Format and validate arrival time
    const formattedArrivalTime = formatTimeValue(trainData.arrivalTime);
    if (!timeRegex.test(formattedArrivalTime)) {
      toast.error("Arrival time should be in HH:MM format (e.g. 14:30)");
      return false;
    }
    
    // Update state with formatted times
    setTrainData(prev => ({
      ...prev,
      departureTime: formattedDepartureTime,
      arrivalTime: formattedArrivalTime
    }));
    
    // Validate numeric fields
    if (isNaN(Number(trainData.price)) || Number(trainData.price) <= 0) {
      toast.error("Price must be a positive number");
      return false;
    }
    if (isNaN(Number(trainData.availableSeats)) || Number(trainData.availableSeats) <= 0) {
      toast.error("Available seats must be a positive number");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Format times again to ensure they're in the correct format
    const formattedData = {
      ...trainData,
      departureTime: formatTimeValue(trainData.departureTime),
      arrivalTime: formatTimeValue(trainData.arrivalTime)
    };
    
    setIsLoading(true);
    try {
      if (initialData?.id) {
        // Update existing train
        await updateTrain({
          ...formattedData,
          id: initialData.id
        });
        toast.success("Train updated successfully");
      } else {
        // Add new train
        await addTrain(formattedData);
        toast.success("Train added successfully");
      }
      
      // Call the onSubmit function passed as prop
      onSubmit(formattedData);
      
      // Clear the form if it's a new train submission
      if (!initialData) {
        setTrainData({
          name: '',
          number: '',
          origin: '',
          destination: '',
          departureTime: '',
          arrivalTime: '',
          date: '',
          price: '',
          availableSeats: '',
        });
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("An error occurred while saving the train");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-railway-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-railway-50 to-white">
        <CardTitle className="text-railway-800">{initialData?.id ? 'Edit Train' : 'Add New Train'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-railway-700">Train Name</Label>
              <Input
                id="name"
                name="name"
                value={trainData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Chennai Express"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number" className="text-railway-700">Train Number</Label>
              <Input
                id="number"
                name="number"
                value={trainData.number}
                onChange={handleChange}
                required
                placeholder="e.g. 12302"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin" className="text-railway-700">Origin</Label>
              <Input
                id="origin"
                name="origin"
                value={trainData.origin}
                onChange={handleChange}
                required
                placeholder="e.g. Delhi"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination" className="text-railway-700">Destination</Label>
              <Input
                id="destination"
                name="destination"
                value={trainData.destination}
                onChange={handleChange}
                required
                placeholder="e.g. Mumbai"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departureTime" className="text-railway-700">Departure Time</Label>
              <Input
                id="departureTime"
                name="departureTime"
                value={trainData.departureTime}
                onChange={handleChange}
                required
                placeholder="HH:MM (e.g. 08:30)"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
              <p className="text-xs text-railway-500">
                Format: HH:MM (24-hour clock)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrivalTime" className="text-railway-700">Arrival Time</Label>
              <Input
                id="arrivalTime"
                name="arrivalTime"
                value={trainData.arrivalTime}
                onChange={handleChange}
                required
                placeholder="HH:MM (e.g. 22:15)"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
              <p className="text-xs text-railway-500">
                Format: HH:MM (24-hour clock)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date" className="text-railway-700">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={trainData.date}
                onChange={handleChange}
                required
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-railway-700">Base Price (₹)</Label>
              <Input
                id="price"
                name="price"
                type="number"
                min="0"
                value={trainData.price}
                onChange={handleChange}
                required
                placeholder="e.g. 1500"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
              <p className="text-xs text-railway-500">
                Fare for AC First Class. Other classes will be calculated automatically.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="availableSeats" className="text-railway-700">Total Seats</Label>
              <Input
                id="availableSeats"
                name="availableSeats"
                type="number"
                min="0"
                value={trainData.availableSeats}
                onChange={handleChange}
                required
                placeholder="e.g. 120"
                className="border-railway-200 focus:border-railway-500 focus:ring-railway-500"
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-railway-600 hover:bg-railway-700 transform transition-transform duration-200 hover:scale-105 active:scale-95"
            disabled={isLoading}
          >
            {isLoading 
              ? 'Processing...' 
              : initialData?.id ? 'Update Train' : 'Add Train'
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TrainForm;
