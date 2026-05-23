export type OutfitType = 'Casual' | 'Business' | 'Night Out';

export interface Outfit {
  id: string;
  type: OutfitType;
  title: string;
  description: string;
  items: string[];
  colorPalette: string[];
  visualPrompt: string;
  
  // Client-side state
  imageUrl?: string;
  isLoadingImage?: boolean;
}
