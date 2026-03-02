import { motion, type HTMLMotionProps } from "framer-motion";
import React from "react";

interface PageWrapperProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export function PageWrapper({ children, ...props }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
