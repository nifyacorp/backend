/**
 * Test script for subscription API filtering and pagination
 * This script tests the enhanced filtering capabilities of the subscription API
 */

import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Settings
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const USER_ID = process.env.USER_ID;

// Validate required environment variables
if (!AUTH_TOKEN) {
  console.error('Auth token is required. Set AUTH_TOKEN environment variable.');
  process.exit(1);
}

if (!USER_ID) {
  console.error('User ID is required. Set USER_ID environment variable.');
  process.exit(1);
}

// Headers for all requests
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'X-User-ID': USER_ID
};

/**
 * Test pagination
 */
async function testPagination() {
  console.log('\n🧪 Testing pagination...');
  
  try {
    // Test different page sizes
    const pageSizes = [5, 10, 20];
    
    for (const pageSize of pageSizes) {
      console.log(`\nTesting page size: ${pageSize}`);
      
      // Get first page
      const firstPageResponse = await fetch(`${BASE_URL}/api/v1/subscriptions?limit=${pageSize}&page=1`, {
        headers
      });
      
      if (!firstPageResponse.ok) {
        console.error(`Error getting first page with limit ${pageSize}:`, await firstPageResponse.text());
        continue;
      }
      
      const firstPageData = await firstPageResponse.json();
      const totalItems = firstPageData.data.pagination.total;
      const totalPages = firstPageData.data.pagination.totalPages;
      
      console.log(`Total items: ${totalItems}, Total pages: ${totalPages}`);
      console.log(`First page has ${firstPageData.data.subscriptions.length} items`);
      
      if (totalPages > 1) {
        // Get second page if available
        const secondPageResponse = await fetch(`${BASE_URL}/api/v1/subscriptions?limit=${pageSize}&page=2`, {
          headers
        });
        
        if (!secondPageResponse.ok) {
          console.error(`Error getting second page with limit ${pageSize}:`, await secondPageResponse.text());
          continue;
        }
        
        const secondPageData = await secondPageResponse.json();
        console.log(`Second page has ${secondPageData.data.subscriptions.length} items`);
        
        // Check for overlapping IDs between pages
        const firstPageIds = new Set(firstPageData.data.subscriptions.map(s => s.id));
        const secondPageIds = new Set(secondPageData.data.subscriptions.map(s => s.id));
        
        const overlappingIds = [...firstPageIds].filter(id => secondPageIds.has(id));
        
        if (overlappingIds.length > 0) {
          console.error('❌ Found overlapping IDs between pages:', overlappingIds);
        } else {
          console.log('✅ No overlapping IDs between pages');
        }
      }
    }
    
    console.log('\n✅ Pagination tests completed');
    return true;
  } catch (error) {
    console.error('❌ Error testing pagination:', error);
    return false;
  }
}

/**
 * Test filtering
 */
async function testFiltering() {
  console.log('\n🧪 Testing filtering capabilities...');
  
  try {
    // Test different filters
    const filters = [
      { name: 'Type filter', params: { type: 'boe' } },
      { name: 'Status filter', params: { status: 'active' } },
      { name: 'Frequency filter', params: { frequency: 'daily' } },
      { name: 'Search filter', params: { search: 'test' } },
      { name: 'Combined filters', params: { type: 'boe', status: 'active' } }
    ];
    
    for (const filter of filters) {
      console.log(`\nTesting ${filter.name}:`);
      
      // Build query string
      const queryParams = new URLSearchParams();
      Object.entries(filter.params).forEach(([key, value]) => {
        queryParams.append(key, value);
      });
      
      const url = `${BASE_URL}/api/v1/subscriptions?${queryParams.toString()}`;
      console.log(`URL: ${url}`);
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        console.error(`Error with ${filter.name}:`, await response.text());
        continue;
      }
      
      const data = await response.json();
      console.log(`Retrieved ${data.data.subscriptions.length} subscriptions`);
      console.log('Applied filters:', data.data.filters);
      
      // Verify filters were applied correctly
      if (filter.params.type) {
        const allMatchType = data.data.subscriptions.every(s => 
          (s.type && s.type.toLowerCase() === filter.params.type.toLowerCase()) ||
          (s.typeName && s.typeName.toLowerCase().includes(filter.params.type.toLowerCase()))
        );
        
        if (!allMatchType) {
          console.error('❌ Type filter not applied correctly');
        } else {
          console.log('✅ Type filter applied correctly');
        }
      }
      
      if (filter.params.status === 'active') {
        const allActive = data.data.subscriptions.every(s => s.active === true);
        
        if (!allActive) {
          console.error('❌ Status filter not applied correctly');
        } else {
          console.log('✅ Status filter applied correctly');
        }
      }
      
      if (filter.params.frequency) {
        const allMatchFrequency = data.data.subscriptions.every(s => 
          s.frequency === filter.params.frequency
        );
        
        if (!allMatchFrequency) {
          console.error('❌ Frequency filter not applied correctly');
        } else {
          console.log('✅ Frequency filter applied correctly');
        }
      }
    }
    
    console.log('\n✅ Filtering tests completed');
    return true;
  } catch (error) {
    console.error('❌ Error testing filtering:', error);
    return false;
  }
}

/**
 * Test statistics endpoint
 */
async function testStatistics() {
  console.log('\n🧪 Testing subscription statistics...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v1/subscriptions/stats`, {
      headers
    });
    
    if (!response.ok) {
      console.error('Error getting subscription statistics:', await response.text());
      return false;
    }
    
    const stats = await response.json();
    console.log('Subscription statistics:');
    console.log(`- Total: ${stats.total}`);
    console.log(`- Active: ${stats.active}`);
    console.log(`- Inactive: ${stats.inactive}`);
    
    // Check if bySource is populated
    if (stats.bySource && Object.keys(stats.bySource).length > 0) {
      console.log('- Sources:');
      Object.entries(stats.bySource).forEach(([source, count]) => {
        console.log(`  - ${source}: ${count}`);
      });
    } else {
      console.log('- No source breakdown available');
    }
    
    // Check if byFrequency is populated
    if (stats.byFrequency && Object.keys(stats.byFrequency).length > 0) {
      console.log('- Frequencies:');
      Object.entries(stats.byFrequency).forEach(([frequency, count]) => {
        console.log(`  - ${frequency}: ${count}`);
      });
    } else {
      console.log('- No frequency breakdown available');
    }
    
    // Basic sanity check
    if (stats.total === stats.active + stats.inactive) {
      console.log('✅ Totals match (active + inactive = total)');
    } else {
      console.error(`❌ Total mismatch: ${stats.total} !== ${stats.active} + ${stats.inactive}`);
    }
    
    console.log('\n✅ Statistics test completed');
    return true;
  } catch (error) {
    console.error('❌ Error testing statistics:', error);
    return false;
  }
}

// Main function
async function runTests() {
  console.log('🔍 Testing enhanced subscription API features');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User ID: ${USER_ID}`);
  
  let passed = 0;
  let failed = 0;
  
  // Test statistics
  if (await testStatistics()) {
    passed++;
  } else {
    failed++;
  }
  
  // Test pagination
  if (await testPagination()) {
    passed++;
  } else {
    failed++;
  }
  
  // Test filtering
  if (await testFiltering()) {
    passed++;
  } else {
    failed++;
  }
  
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});