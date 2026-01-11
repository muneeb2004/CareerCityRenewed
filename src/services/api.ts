import { toast } from 'react-hot-toast';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

const api = {
  async request(endpoint: string, options: FetchOptions = {}) {
    const { params, ...customConfig } = options;
    
    // Construct URL with query parameters if provided
    let url = endpoint.startsWith('/') ? `/api${endpoint}` : `/api/${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...customConfig.headers,
    };

    const config: RequestInit = {
      ...customConfig,
      headers,
    };

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/staff/login';
        }
        const error = await response.json().catch(() => ({}));
        return Promise.reject({ response: { status: 401, data: error } });
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        toast.error('You do not have permission to perform this action');
      }

      // Handle 500+ Server Errors
      if (response.status >= 500) {
        toast.error('Server error. Please try again later.');
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return Promise.reject({ response: { status: response.status, data } });
      }

      return { data, status: response.status };
    } catch (error) {
      console.error('API Request Error:', error);
      return Promise.reject(error);
    }
  },

  get(endpoint: string, options?: FetchOptions) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint: string, body?: any, options?: FetchOptions) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  put(endpoint: string, body?: any, options?: FetchOptions) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  patch(endpoint: string, body?: any, options?: FetchOptions) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(endpoint: string, options?: FetchOptions) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },
};

export default api;