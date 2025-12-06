import toast, { ToastOptions } from 'react-hot-toast';

const defaultOptions: ToastOptions = {
  duration: 4000,
  style: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    color: '#374151',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
};

export const showSuccess = (message: string, options?: ToastOptions) => {
  toast.success(message, {
    ...defaultOptions,
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #10B981',
    },
    iconTheme: {
      primary: '#10B981',
      secondary: '#FFFFFF',
    },
    ...options,
  });
};

export const showError = (message: string, options?: ToastOptions) => {
  toast.error(message, {
    ...defaultOptions,
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #EF4444',
    },
    iconTheme: {
      primary: '#EF4444',
      secondary: '#FFFFFF',
    },
    ...options,
  });
};

export const showLoading = (message: string, options?: ToastOptions) => {
  return toast.loading(message, {
    ...defaultOptions,
    style: {
      ...defaultOptions.style,
      borderLeft: '4px solid #3B82F6',
    },
    ...options,
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
