import { createContext } from "react";

interface OnboardingTourContextType {
  startTour: () => void;
  isMobile: boolean;
}

export const OnboardingTourContext = createContext<OnboardingTourContextType>({
  startTour: () => {},
  isMobile: false,
});
