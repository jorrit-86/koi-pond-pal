import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TrendingUp, Calendar, Ruler, Download, Target, Award, Activity } from 'lucide-react';

interface GrowthDataPoint {
  date: string;
  length: number;
  type: 'purchase' | 'measurement';
  description?: string;
}

interface GrowthChartProps {
  koiId: string;
  koiName: string;
  isOpen: boolean;
  onClose: () => void;
  onAddMeasurement?: () => void; // Callback to add measurement
}

export function GrowthChart({ koiId, koiName, isOpen, onClose, onAddMeasurement }: GrowthChartProps) {
  const { user, session } = useAuth();
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [koiData, setKoiData] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '6months' | '1year' | '2years'>('all');

  useEffect(() => {
    if (isOpen && koiId && user) {
      loadGrowthData();
    }
  }, [isOpen, koiId, user]);

  const loadGrowthData = async () => {
    if (!user || !koiId) {
      setLoading(false);
      return;
    }

    try {
      console.log('loadGrowthData called with koiId:', koiId); // Debug log
      setLoading(true);
      
      // Set a timeout to reset loading state in case of authentication timeout
      const timeoutId = setTimeout(() => {
        console.log('Loading timeout - resetting loading state'); // Debug log
        setLoading(false);
      }, 10000); // 10 second timeout
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      let koiData: any = null;
      let measurements: any[] = [];
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading growth data using direct fetch with access token...');
          
          // Load koi basic data
          const koiResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?id=eq.${koiId}&select=name,length_at_purchase,purchase_date`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (koiResponse.ok) {
            const koiDataArray = await koiResponse.json();
            koiData = Array.isArray(koiDataArray) ? koiDataArray[0] : koiDataArray;
            console.log('Koi data loaded (direct fetch):', koiData);
          } else {
            console.error('Error loading koi data (direct fetch):', koiResponse.status);
          }
          
          // Load measurement data from logbook
          const measurementsResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries?koi_id=eq.${koiId}&entry_type=eq.measurement&select=entry_date,length_cm,description&order=entry_date.asc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (measurementsResponse.ok) {
            const measurementsData = await measurementsResponse.json();
            measurements = Array.isArray(measurementsData) ? measurementsData : [measurementsData];
            // Filter out null length_cm values
            measurements = measurements.filter((m: any) => m.length_cm != null);
            console.log('Measurements data loaded (direct fetch):', measurements.length, 'measurements');
          } else {
            console.error('Error loading measurements (direct fetch):', measurementsResponse.status);
          }
        } catch (error: any) {
          console.error('Error loading growth data with direct fetch:', error);
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase queries
      if (!koiData) {
        const { data: koiDataResult, error: koiError } = await supabase
          .from('koi')
          .select('name, length_at_purchase, purchase_date')
          .eq('id', koiId)
          .single();

        console.log('Koi data loaded (normal query):', koiDataResult);
        console.log('Koi error:', koiError);

        if (koiError) {
          console.error('Error loading koi data:', koiError);
          clearTimeout(timeoutId);
          setLoading(false);
          return;
        }

        koiData = koiDataResult;
      }

      setKoiData(koiData);

      // If we don't have measurements yet, try normal Supabase query
      if (measurements.length === 0) {
        const { data: measurementsResult, error: measurementsError } = await supabase
          .from('koi_log_entries')
          .select('entry_date, length_cm, description')
          .eq('koi_id', koiId)
          .eq('entry_type', 'measurement')
          .not('length_cm', 'is', null)
          .order('entry_date', { ascending: true });

        console.log('Measurements data loaded (normal query):', measurementsResult);
        console.log('Measurements error:', measurementsError);

        if (measurementsError) {
          console.error('Error loading measurements:', measurementsError);
          // Don't return - we might still have purchase data to show
        } else {
          measurements = measurementsResult || [];
        }
      }

      // Combine purchase data and measurements
      const dataPoints: GrowthDataPoint[] = [];

      console.log('Combining data - koiData:', koiData); // Debug log

      // Add purchase data if available
      if (koiData.length_at_purchase && koiData.purchase_date) {
        console.log('Adding purchase data:', { date: koiData.purchase_date, length: koiData.length_at_purchase }); // Debug log
        dataPoints.push({
          date: koiData.purchase_date,
          length: koiData.length_at_purchase,
          type: 'purchase',
          description: 'Lengte bij aanschaf'
        });
      }

      // Add measurements
      console.log('Adding measurements:', measurements); // Debug log
      measurements?.forEach((measurement: any) => {
        console.log('Adding measurement:', measurement); // Debug log
        dataPoints.push({
          date: measurement.entry_date,
          length: measurement.length_cm,
          type: 'measurement',
          description: measurement.description || 'Meting'
        });
      });

      // Sort by date - ensure chronological order
      dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log('Final growth data:', dataPoints); // Debug log
      setGrowthData(dataPoints);
      clearTimeout(timeoutId); // Clear timeout on success
      
      // If no data points, show the "add measurement" message immediately
      if (dataPoints.length === 0) {
        console.log('No growth data found - showing add measurement message'); // Debug log
      }
    } catch (error) {
      console.error('Error loading growth data:', error);
      setLoading(false); // Ensure loading is reset even on error
      clearTimeout(timeoutId); // Clear timeout on error
    } finally {
      setLoading(false);
    }
  };

  const calculateGrowthRate = () => {
    if (growthData.length < 2) return null;
    
    const first = growthData[0];
    const last = growthData[growthData.length - 1];
    const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
    const lengthDiff = last.length - first.length;
    
    // Calculate growth rate per month and per year
    const growthPerMonth = daysDiff > 0 ? (lengthDiff / daysDiff) * 30 : 0;
    const growthPerYear = daysDiff > 0 ? (lengthDiff / daysDiff) * 365 : 0;
    
    // Calculate average growth between measurements
    let totalGrowthBetweenMeasurements = 0;
    let measurementCount = 0;
    
    for (let i = 1; i < growthData.length; i++) {
      if (growthData[i].type === 'measurement') {
        totalGrowthBetweenMeasurements += growthData[i].length - growthData[i-1].length;
        measurementCount++;
      }
    }
    
    const averageGrowthPerMeasurement = measurementCount > 0 ? totalGrowthBetweenMeasurements / measurementCount : 0;
    
    // Calculate growth trend (positive, negative, or stable)
    const recentMeasurements = growthData.filter(d => d.type === 'measurement').slice(-3);
    let trend = 'stable';
    if (recentMeasurements.length >= 2) {
      const recentGrowth = recentMeasurements[recentMeasurements.length - 1].length - recentMeasurements[0].length;
      if (recentGrowth > 1) trend = 'positive';
      else if (recentGrowth < -1) trend = 'negative';
    }
    
    return {
      totalGrowth: lengthDiff,
      daysDiff: Math.round(daysDiff),
      growthPerMonth,
      growthPerYear,
      averageGrowthPerMeasurement,
      measurementCount,
      trend,
      firstMeasurement: first,
      lastMeasurement: last
    };
  };

  const growthStats = calculateGrowthRate();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Groeiontwikkeling - {koiName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Groeigegevens laden...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            {growthStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm text-green-700 font-medium">Totale groei</p>
                        <p className="text-2xl font-bold text-green-800">
                          +{growthStats.totalGrowth.toFixed(1)} cm
                        </p>
                        <p className="text-xs text-green-600">
                          van {growthStats.firstMeasurement.length}cm naar {growthStats.lastMeasurement.length}cm
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm text-blue-700 font-medium">Groei per maand</p>
                        <p className="text-2xl font-bold text-blue-800">
                          {growthStats.growthPerMonth.toFixed(1)} cm
                        </p>
                        <p className="text-xs text-blue-600">
                          {growthStats.growthPerYear.toFixed(1)} cm per jaar
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm text-purple-700 font-medium">Gemiddelde groei</p>
                        <p className="text-2xl font-bold text-purple-800">
                          {growthStats.averageGrowthPerMeasurement.toFixed(1)} cm
                        </p>
                        <p className="text-xs text-purple-600">
                          per meting ({growthStats.measurementCount} metingen)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-600" />
                      <div>
                        <p className="text-sm text-orange-700 font-medium">Groeitrend</p>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={growthStats.trend === 'positive' ? 'default' : growthStats.trend === 'negative' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {growthStats.trend === 'positive' ? '📈 Groeiend' : 
                             growthStats.trend === 'negative' ? '📉 Afnemend' : '➡️ Stabiel'}
                          </Badge>
                        </div>
                        <p className="text-xs text-orange-600 mt-1">
                          {growthStats.daysDiff} dagen periode
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Growth Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Groeigegevens
                </CardTitle>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {growthData.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Ruler className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Geen groeigegevens</h3>
                    <p className="text-muted-foreground mb-4">
                      Voeg metingen toe in het logboek om groeiontwikkeling te zien
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        console.log('Eerste meting knop geklikt'); // Debug log
                        
                        // Close the growth chart first
                        onClose();
                        
                        if (onAddMeasurement) {
                          console.log('Calling onAddMeasurement'); // Debug log
                          onAddMeasurement(); // Trigger add measurement
                        } else {
                          console.log('onAddMeasurement is not defined'); // Debug log
                        }
                      }}
                    >
                      Eerste meting toevoegen
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {growthData.map((point, index) => {
                      const growthFromPrevious = index > 0 ? point.length - growthData[index - 1].length : 0;
                      const daysFromPrevious = index > 0 ? 
                        Math.round((new Date(point.date).getTime() - new Date(growthData[index - 1].date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      
                      return (
                        <div key={index} className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm ${
                          point.type === 'purchase' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                        }`}>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${
                                point.type === 'purchase' ? 'bg-blue-500' : 'bg-green-500'
                              }`} />
                              <Badge 
                                variant={point.type === 'purchase' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {point.type === 'purchase' ? '🏪 Aanschaf' : '📏 Meting'}
                              </Badge>
                              <span className="font-semibold text-lg">{point.length} cm</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(point.date).toLocaleDateString('nl-NL', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </p>
                              {point.description && (
                                <p className="text-xs text-gray-600 mt-1">{point.description}</p>
                              )}
                            </div>
                          </div>
                          
                          {index > 0 && (
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${
                                  growthFromPrevious > 0 ? 'text-green-600' : 
                                  growthFromPrevious < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {growthFromPrevious > 0 ? '+' : ''}{growthFromPrevious.toFixed(1)} cm
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {daysFromPrevious} dagen
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                vs vorige meting
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enhanced Growth Chart Visualization */}
            {growthData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Groeigrafiek
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Chart Container */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6">
                      <div className="flex gap-4">
                        {/* Y-Axis with centimeters */}
                        <div className="flex flex-col justify-between h-48 w-12">
                          {(() => {
                            const maxLength = Math.max(...growthData.map(p => p.length));
                            const minLength = Math.min(...growthData.map(p => p.length));
                            const range = maxLength - minLength;
                            const step = Math.max(1, Math.ceil(range / 5)); // 5 steps max
                            const startValue = Math.floor((minLength - 5) / step) * step;
                            const endValue = Math.ceil((maxLength + 5) / step) * step;
                            const steps = [];
                            
                            for (let i = startValue; i <= endValue; i += step) {
                              steps.push(i);
                            }
                            
                            // Reverse the order so highest values are at the top
                            return steps.reverse().map((value, index) => (
                              <div key={value} className="flex items-center justify-end">
                                <div className="text-xs text-gray-600 font-medium">
                                  {value}cm
                                </div>
                                <div className="w-2 h-px bg-gray-300 ml-2"></div>
                              </div>
                            ));
                          })()}
                        </div>
                        
                        {/* Chart Area */}
                        <div className="flex-1 relative">
                          <div className="relative h-48">
                            {/* Grid lines */}
                            <div className="absolute inset-0 pointer-events-none">
                              {(() => {
                                const maxLength = Math.max(...growthData.map(p => p.length));
                                const minLength = Math.min(...growthData.map(p => p.length));
                                const range = maxLength - minLength;
                                const step = Math.max(1, Math.ceil(range / 5));
                                const startValue = Math.floor((minLength - 5) / step) * step;
                                const endValue = Math.ceil((maxLength + 5) / step) * step;
                                const steps = [];
                                
                                for (let i = startValue; i <= endValue; i += step) {
                                  steps.push(i);
                                }
                                
                                return steps.map((value, index) => {
                                  const yPosition = 100 - ((value - (minLength - 5)) / ((maxLength + 5) - (minLength - 5))) * 100;
                                  return (
                                    <div 
                                      key={value}
                                      className="absolute w-full h-px bg-gray-200 opacity-30"
                                      style={{ 
                                        top: `${yPosition}%`,
                                        left: 0,
                                        right: 0
                                      }}
                                    />
                                  );
                                });
                              })()}
                            </div>
                            
                            {/* Growth Line */}
                            <svg className="absolute inset-0 w-full h-full">
                              {growthData.map((point, index) => {
                                if (index === 0) return null;
                                
                                const maxLength = Math.max(...growthData.map(p => p.length));
                                const minLength = Math.min(...growthData.map(p => p.length));
                                const prevPoint = growthData[index - 1];
                                const currentPoint = point;
                                
                                const x1 = ((index - 1) / (growthData.length - 1)) * 100;
                                const y1 = 100 - ((prevPoint.length - (minLength - 5)) / ((maxLength + 5) - (minLength - 5))) * 100;
                                const x2 = (index / (growthData.length - 1)) * 100;
                                const y2 = 100 - ((currentPoint.length - (minLength - 5)) / ((maxLength + 5) - (minLength - 5))) * 100;
                                
                                
                                return (
                                  <line
                                    key={index}
                                    x1={`${x1}%`}
                                    y1={`${y1}%`}
                                    x2={`${x2}%`}
                                    y2={`${y2}%`}
                                    stroke="url(#gradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                  />
                                );
                              })}
                              
                              {/* Gradient definition */}
                              <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#3b82f6" />
                                  <stop offset="100%" stopColor="#10b981" />
                                </linearGradient>
                              </defs>
                            </svg>
                            
                            {/* Data Points */}
                            {growthData.map((point, index) => {
                              const maxLength = Math.max(...growthData.map(p => p.length));
                              const minLength = Math.min(...growthData.map(p => p.length));
                              const x = (index / (growthData.length - 1)) * 100;
                              const y = 100 - ((point.length - (minLength - 5)) / ((maxLength + 5) - (minLength - 5))) * 100;
                              const isHighest = point.length === maxLength;
                              const isLowest = point.length === minLength;
                              
                              
                              return (
                                <div
                                  key={index}
                                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                                  style={{
                                    left: `${x}%`,
                                    top: `${y}%`
                                  }}
                                >
                                  <div 
                                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 hover:scale-125 ${
                                      point.type === 'purchase' 
                                        ? 'bg-blue-500 border-blue-600' 
                                        : 'bg-green-500 border-green-600'
                                    }`}
                                    title={`${point.length} cm - ${new Date(point.date).toLocaleDateString('nl-NL')}`}
                                  />
                                  
                                  
                                  {/* Hover tooltip */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                    <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                                      {point.length}cm - {new Date(point.date).toLocaleDateString('nl-NL')}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* X-Axis Labels with time */}
                      <div className="flex justify-between mt-2 ml-12">
                        {(() => {
                          if (growthData.length === 0) return null;
                          
                          const firstDate = new Date(growthData[0].date);
                          const lastDate = new Date(growthData[growthData.length - 1].date);
                          const timeDiff = lastDate.getTime() - firstDate.getTime();
                          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
                          
                          // Generate time labels based on the time span
                          const labels = [];
                          if (daysDiff <= 30) {
                            // Show days - keep chronological order (old to new)
                            for (let i = 0; i < growthData.length; i++) {
                              const date = new Date(growthData[i].date);
                              const shortYear = date.getFullYear().toString().slice(-2);
                              labels.push({
                                text: `${date.getDate()}-${date.getMonth() + 1}`,
                                fullText: date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                              });
                            }
                          } else if (daysDiff <= 365) {
                            // Show months - keep chronological order (old to new)
                            const months = new Set();
                            growthData.forEach(point => {
                              const date = new Date(point.date);
                              months.add(`${date.getFullYear()}-${date.getMonth()}`);
                            });
                            
                            // Sort months chronologically (oldest first)
                            Array.from(months).sort((a, b) => {
                              const [yearA, monthA] = a.split('-');
                              const [yearB, monthB] = b.split('-');
                              if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
                              return parseInt(monthA) - parseInt(monthB);
                            }).forEach(month => {
                              const [year, monthNum] = month.split('-');
                              const date = new Date(parseInt(year), parseInt(monthNum));
                              const shortYear = year.slice(-2); // Get last 2 digits of year
                              labels.push({
                                text: `${date.toLocaleDateString('nl-NL', { month: 'short' })}-${shortYear}`,
                                fullText: date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
                              });
                            });
                          } else {
                            // Show years - keep chronological order (old to new)
                            const years = new Set();
                            growthData.forEach(point => {
                              const date = new Date(point.date);
                              years.add(date.getFullYear());
                            });
                            
                            Array.from(years).sort((a, b) => parseInt(a) - parseInt(b)).forEach(year => {
                              labels.push({
                                text: year.toString(),
                                fullText: year.toString()
                              });
                            });
                          }
                          
                          return labels.map((label, index) => (
                            <div key={index} className="flex-1 text-center">
                              <div className="text-xs text-gray-600 font-medium" title={label.fullText}>
                                {label.text}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                      
                      {/* Chart Legend */}
                      <div className="flex items-center justify-center mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600 font-medium">
                          Lengte in centimeters
                        </div>
                      </div>
                    </div>
                    
                    {/* Growth Insights */}
                    {growthStats && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="font-semibold text-green-800 mb-2">Beste groeiperiode</h4>
                          <p className="text-sm text-green-700">
                            {growthStats.averageGrowthPerMeasurement > 0 
                              ? `Gemiddeld ${growthStats.averageGrowthPerMeasurement.toFixed(1)}cm per meting`
                              : 'Geen significante groei gemeten'
                            }
                          </p>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-800 mb-2">Groeivoorspelling</h4>
                          <p className="text-sm text-blue-700">
                            {growthStats.growthPerMonth > 0 
                              ? `Verwacht ${(growthStats.growthPerMonth * 6).toFixed(1)}cm groei in 6 maanden`
                              : 'Stabiele groei verwacht'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
