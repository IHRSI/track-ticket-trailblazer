
import React, { useState, useEffect } from 'react';
import { queryLogEvents } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Database, Eye, EyeOff } from "lucide-react";

interface Query {
  sql: string;
  operation: string;
  timestamp: string;
  id: string;
}

const SqlQueryLogger: React.FC = () => {
  const [queries, setQueries] = useState<Query[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    // Subscribe to query log events
    const removeListener = queryLogEvents.addListener((query) => {
      setQueries(prev => [
        {
          ...query,
          id: Math.random().toString(36).substring(2, 9)
        },
        ...prev.slice(0, 99) // Keep the last 100 queries
      ]);
    });
    
    return () => removeListener();
  }, []);
  
  const clearQueries = () => {
    setQueries([]);
  };
  
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };
  
  const getOperationColor = (operation: string) => {
    switch(operation.toUpperCase()) {
      case 'SELECT': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'INSERT': return 'bg-green-100 text-green-800 border-green-200';
      case 'UPDATE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200';
      case 'RPC': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  return (
    <Card className="border-railway-200 shadow-md mt-6">
      <CardHeader className="bg-gradient-to-r from-railway-50 to-white flex flex-row items-center justify-between py-3">
        <CardTitle className="flex items-center gap-2 text-railway-800 text-lg">
          <Database size={18} /> SQL Query Logger
        </CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleVisibility}
            className="flex items-center gap-1 border-railway-200"
          >
            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
            {isVisible ? 'Hide' : 'Show'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearQueries}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
          >
            <Trash2 size={14} /> Clear
          </Button>
        </div>
      </CardHeader>
      {isVisible && (
        <CardContent className="p-0">
          <ScrollArea className="h-64 rounded-md">
            {queries.length > 0 ? (
              <div className="divide-y">
                {queries.map((query) => (
                  <div key={query.id} className="p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-1">
                      <Badge className={getOperationColor(query.operation)}>
                        {query.operation}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(query.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap bg-gray-50 p-2 rounded border border-gray-200">
                      {query.sql}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex justify-center items-center h-full text-gray-500">
                No queries logged yet
              </div>
            )}
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
};

export default SqlQueryLogger;
