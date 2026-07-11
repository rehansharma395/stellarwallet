import { describe, test, expect } from 'vitest';
import {
  formatStellarAddress,
  isValidStellarAddress,
  stroopsToUnits,
  unitsToStroops,
  calculateAllocation,
} from '../utils/math';

describe('Conduit Frontend Utility & Math Operations', () => {
  // Test 1: Stellar Address Formatting
  test('formatStellarAddress shortens 56-character addresses without string trimming bugs', () => {
    const address = 'GDCONDUITADMINXXYTWENTYTWOSIXMARKETINGVAULTXX55566677722';
    // Length is 56 characters
    expect(address).toHaveLength(56);
    
    const formatted = formatStellarAddress(address);
    // e.g. GDCONDUIT...566677722
    expect(formatted).toBe('GDCONDUIT...566677722');
    expect(formatted.length).toBe(21); // 9 chars prefix + 3 dots + 9 chars suffix = 21
  });

  test('formatStellarAddress returns original string if length is not 56', () => {
    expect(formatStellarAddress('GDCONDUIT')).toBe('GDCONDUIT');
    expect(formatStellarAddress('')).toBe('');
  });

  // Test 2: Stellar Address Validation
  test('isValidStellarAddress validates correct/incorrect Stellar address structures', () => {
    const validAddress = 'GDCONDUITADMINXXYTWENTYTWOSIXMARKETINGVAULTXX55566677722';
    expect(isValidStellarAddress(validAddress)).toBe(true);

    const invalidShort = 'GDCONDUIT';
    expect(isValidStellarAddress(invalidShort)).toBe(false);

    const invalidPrefix = 'ADCONDUITADMINXXYTWENTYTWOSIXMARKETINGVAULTXX55566677722'; // starts with A
    expect(isValidStellarAddress(invalidPrefix)).toBe(false);

    const invalidChars = 'GDCONDUITADMINXXYTWENTYTWOSIXMARKETINGVAULTXX55566677720'; // contains 0 which is invalid in Stellar Base32
    expect(isValidStellarAddress(invalidChars)).toBe(false);
  });

  // Test 3: Stroops to Units conversion
  test('stroopsToUnits handles Stroops vs standard assets map reliably', () => {
    // 1 unit = 10,000,000 Stroops
    expect(stroopsToUnits(10_000_000)).toBe(1);
    expect(stroopsToUnits(5_000_000)).toBe(0.5);
    expect(stroopsToUnits(1)).toBe(0.0000001);
    expect(stroopsToUnits('100000000')).toBe(10);
    expect(stroopsToUnits(0n)).toBe(0);
  });

  // Test 4: Units to Stroops conversion
  test('unitsToStroops converts unit numbers to BigInt Stroops', () => {
    expect(unitsToStroops(1)).toBe(10_000_000n);
    expect(unitsToStroops(0.5)).toBe(5_000_000n);
    expect(unitsToStroops(0.0000001)).toBe(1n);
    expect(unitsToStroops(12.3456789)).toBe(123_456_789n);
    expect(unitsToStroops(-1)).toBe(0n);
  });

  // Test 5: Allocation Math
  test('calculateAllocation calculates fractional allocations across micro-aid campaigns correctly', () => {
    // Total: 100 USDC, Weight: 2, Total weight: 5 => 40 USDC
    expect(calculateAllocation(100, 2, 5)).toBe(40);
    // Fractional target weight: Total: 10 USDC, Weight: 1, Total weight: 3 => 3.3333333 USDC
    expect(calculateAllocation(10, 1, 3)).toBe(3.3333333);
    // Boundary conditions
    expect(calculateAllocation(100, 0, 5)).toBe(0);
    expect(calculateAllocation(100, 2, 0)).toBe(0);
    expect(calculateAllocation(0, 2, 5)).toBe(0);
  });
});
