// Utility functions for koi age calculations and Japanese age terminology

/**
 * Calculate the current age of a koi based on purchase date and age at purchase
 * Age updates automatically on January 1st of each year
 */
export function calculateCurrentAge(purchaseDate: string, ageAtPurchase: number): number {
  if (!purchaseDate || ageAtPurchase === undefined || ageAtPurchase === null) {
    return 0;
  }

  const purchase = new Date(purchaseDate);
  const currentDate = new Date();
  
  // Get the year of purchase and current year
  const purchaseYear = purchase.getFullYear();
  const currentYear = currentDate.getFullYear();
  
  // Calculate years elapsed since purchase
  const yearsElapsed = currentYear - purchaseYear;
  
  // Current age = age at purchase + years elapsed
  return ageAtPurchase + yearsElapsed;
}

/**
 * Get Japanese age terminology for koi
 */
export function getJapaneseAgeTerm(age: number): string {
  const ageTerms: { [key: number]: string } = {
    1: 'Tosai',
    2: 'Nisai',
    3: 'Sansai',
    4: 'Yonsai',
    5: 'Gosai',
    6: 'Rokusai',
    7: 'Nanasai',
    8: 'Hassai / Yasai',
    9: 'Kyūsai',
    10: 'Jūsai',
    11: 'Jūissai',
    12: 'Jūnisai',
    13: 'Jūsansai',
    14: 'Jūyonsai',
    15: 'Jūgosai',
    20: 'Nijūsai',
    30: 'Sanjūsai'
  };

  // Return specific term if available, otherwise return generic format
  if (ageTerms[age]) {
    return ageTerms[age];
  }

  // For ages not in the table, return the age with "jaar"
  return `${age} jaar`;
}

/**
 * Get age display text for koi (age + Japanese term)
 */
export function getAgeDisplayText(age: number): string {
  const japaneseTerm = getJapaneseAgeTerm(age);
  return `${age} jaar (${japaneseTerm})`;
}
