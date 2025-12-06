'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Only student-records needs the special flex layout for fixed scrolling
  const isStudentRecords = pathname === '/staff/student-records';

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={isStudentRecords ? "flex-1 flex flex-col min-h-0" : ""}
    >
      {children}
    </motion.div>
  );
}
