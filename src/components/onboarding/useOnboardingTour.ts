import { useContext } from "react";
import { OnboardingTourContext } from "./OnboardingTourContext";

export function useOnboardingTour() {
  return useContext(OnboardingTourContext);
}
