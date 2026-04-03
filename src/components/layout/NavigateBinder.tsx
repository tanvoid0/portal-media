import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAppNavigate } from "@/nav/appNavigate";

export function NavigateBinder() {
  const navigate = useNavigate();

  useEffect(() => {
    setAppNavigate(navigate);
  }, [navigate]);

  return null;
}
