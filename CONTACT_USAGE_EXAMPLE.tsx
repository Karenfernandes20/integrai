// EXEMPLO DE USO DO MODAL DE CONTATOS
// Adicione este código em qualquer componente onde você precisa criar contatos

import React, { useState, useEffect } from 'react';
import { NewContactModal } from '../components/NewContactModal';
import api from '../services/api';

export const ExampleSalesForm = () => {
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any>(null);
    const [showNewContactModal, setShowNewContactModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Carregar contatos ao iniciar
    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        try {
            const response = await api.get('/contacts');
            setContacts(response.data);
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    };

    // Callback quando novo contato é criado
    const handleContactCreated = (newContact: any) => {
        // 1. Adicionar à lista local
        setContacts(prev => [newContact, ...prev]);

        // 2. Selecionar automaticamente
        setSelectedContact(newContact);

        // 3. Limpar busca
        setSearchTerm('');
    };

    // Filtrar contatos baseado na busca
    const filteredContacts = contacts.filter(contact =>
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.phone?.includes(searchTerm)
    );

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Formulário de Venda</h2>

            {/* Campo de Seleção de Cliente */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cliente
                </label>

                {/* Busca de Cliente */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Botão Novo Cliente */}
                    <button
                        onClick={() => setShowNewContactModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                        + Novo Cliente
                    </button>
                </div>

                {/* Lista de Clientes Filtrados */}
                {searchTerm && (
                    <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                        {filteredContacts.length > 0 ? (
                            filteredContacts.map(contact => (
                                <button
                                    key={contact.id}
                                    onClick={() => {
                                        setSelectedContact(contact);
                                        setSearchTerm('');
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="font-medium">{contact.name}</div>
                                    <div className="text-sm text-gray-500">{contact.phone}</div>
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                                Nenhum cliente encontrado
                            </div>
                        )}
                    </div>
                )}

                {/* Cliente Selecionado */}
                {selectedContact && !searchTerm && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="font-medium text-blue-900">
                                    {selectedContact.name}
                                </div>
                                <div className="text-sm text-blue-700">
                                    {selectedContact.phone}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedContact(null)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                                Alterar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Outros Campos do Formulário */}
            <div className="space-y-4">
                {/* Produto/Serviço */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Produto/Serviço
                    </label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Digite o produto ou serviço"
                    />
                </div>

                {/* Valor */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Valor
                    </label>
                    <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="R$ 0,00"
                    />
                </div>

                {/* Botão Salvar */}
                <button
                    disabled={!selectedContact}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Salvar Venda
                </button>
            </div>

            {/* Modal de Novo Contato */}
            <NewContactModal
                isOpen={showNewContactModal}
                onClose={() => setShowNewContactModal(false)}
                onContactCreated={handleContactCreated}
            />
        </div>
    );
};
