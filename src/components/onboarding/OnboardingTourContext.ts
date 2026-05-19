import { createContext } from "react";

interface OnboardingTourContextType {
  startTour: () => void;
}

export const OnboardingTourContext = createContext<OnboardingTourContextType>({
  startTour: () => {},
});
