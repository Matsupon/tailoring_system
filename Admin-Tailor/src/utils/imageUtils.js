// Utility function to get the correct image URL
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Get the base URL from the API configuration
  const baseURL = process.env.NODE_ENV === "development"
    ? "http://queuetailoring.surigao.ph"
    : "";
  
  // If the path already starts with /storage, use it directly
  if (imagePath.startsWith('/storage/')) {
    return `${baseURL}${imagePath}`;
  }
  
  // If the path doesn't start with storage/, add it
  if (imagePath.startsWith('storage/')) {
    return `${baseURL}/${imagePath}`;
  }
  
  // Otherwise, assume it needs the full storage path
  return `${baseURL}/storage/${imagePath}`;
};

// Function to handle image loading errors
export const handleImageError = (e) => {
  console.warn('Image failed to load:', e.target.src);
  e.target.style.display = 'none';
};

// Function to check if an image URL is valid
export const isValidImageUrl = (url) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Debug function to log image URLs
export const debugImageUrl = (originalPath, finalUrl) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Image URL Debug:', { originalPath, finalUrl });
  }
};