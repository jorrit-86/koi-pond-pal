// Simple Test Data - No Database Queries
// This will help us determine if the problem is with database or navigation

export const testData = {
  koi: [
    {
      id: 'test-koi-1',
      name: 'Test Koi 1',
      variety: 'Kohaku',
      age: 2,
      length: 25,
      healthStatus: 'good',
      dateAdded: '2023-01-01',
      photo_url: null
    },
    {
      id: 'test-koi-2', 
      name: 'Test Koi 2',
      variety: 'Sanke',
      age: 1,
      length: 20,
      healthStatus: 'excellent',
      dateAdded: '2024-01-01',
      photo_url: null
    }
  ],
  waterParameters: [
    {
      id: 'test-param-1',
      parameter_type: 'ph',
      value: 7.2,
      unit: 'pH',
      measured_at: new Date().toISOString(),
      notes: 'Test measurement'
    },
    {
      id: 'test-param-2',
      parameter_type: 'temperature',
      value: 18.5,
      unit: '°C',
      measured_at: new Date().toISOString(),
      notes: 'Test measurement'
    }
  ],
  waterChanges: [
    {
      id: 'test-change-1',
      liters_added: 100,
      water_type: 'tap_water',
      reason: 'routine',
      changed_at: new Date().toISOString(),
      notes: 'Test water change'
    }
  ]
}

