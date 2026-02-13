
const API_URL = '/api';

interface ApiResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: any;
}

class ApiError extends Error {
    response: ApiResponse;
    constructor(message: string, response: ApiResponse) {
        super(message);
        this.response = response;
    }
}

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const request = async (method: string, url: string, data?: any): Promise<ApiResponse> => {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
    };

    const config = {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
    };

    const fullUrl = url.startsWith('/') ? `${API_URL}${url}` : `${API_URL}/${url}`;

    try {
        const response = await fetch(fullUrl, config);

        let responseData;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        const result: ApiResponse = {
            data: responseData,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            config
        };

        if (!response.ok) {
            throw new ApiError('Request failed', result);
        }

        return result;
    } catch (error: any) {
        if (error instanceof ApiError) {
            throw error;
        }
        // Handle network errors
        throw new ApiError(error.message || 'Network Error', {
            data: { error: error.message },
            status: 0,
            statusText: '',
            headers: {},
            config
        });
    }
};

const api = {
    get: (url: string) => request('GET', url),
    post: (url: string, data: any) => request('POST', url, data),
    put: (url: string, data: any) => request('PUT', url, data),
    delete: (url: string) => request('DELETE', url),
    patch: (url: string, data: any) => request('PATCH', url, data),
};

export default api;
