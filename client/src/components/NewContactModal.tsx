import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

interface NewContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onContactCreated: (contact: any) => void;
}

export const NewContactModal: React.FC<NewContactModalProps> = ({ isOpen, onClose, onContactCreated }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/contacts', formData);

            // Notify parent component
            onContactCreated(response.data);

            // Reset form
            setFormData({ name: '', phone: '', email: '' });

            // Close modal
            onClose();
        } catch (err: any) {
            if (err.response?.status === 409) {
                setError('Contato já existe com este telefone');
            } else if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Erro ao criar contato. Tente novamente.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Novo Contato</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {/* Name Field */}
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                Nome *
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Nome completo"
                            />
                        </div>

                        {/* Phone Field */}
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone *
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="(11) 99999-9999"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Digite com DDD
                            </p>
                        </div>

                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="email@exemplo.com"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Salvando...' : 'Criar Contato'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
