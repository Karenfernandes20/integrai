import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface DiagnosticData {
  instance_found: boolean;
  instance: {
    id: number;
    name: string;
    instance_key: string;
    api_key_exists: boolean;
    api_key_length: number;
    api_key_last_4: string;
    status: string;
    created_at: string;
  };
  company: {
    evolution_url: string;
    evolution_instance: string;
  };
  diagnostic: {
    has_api_key: boolean;
    api_key_valid: boolean;
    problem: string;
  };
}

export default function InstanceDiagnostics() {
  const { token } = useAuth();
  const [companyId, setCompanyId] = useState('');
  const [instanceKey, setInstanceKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const handleCheckInstance = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8083/api/evolution/debug/instance/${companyId}/${instanceKey}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setDiagnostic(data);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
        setDiagnostic(null);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Connection error: ${error.message}` });
      setDiagnostic(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApiKey = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'warning', text: 'Please enter an API key' });
      return;
    }
    
    setUpdating(true);
    try {
      const response = await fetch(
        `http://localhost:8083/api/evolution/instance/${companyId}/${instanceKey}/api-key`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ apiKey })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ type: 'success', text: `✓ ${data.message}` });
        setApiKey('');
        // Refresh diagnostic
        setTimeout(handleCheckInstance, 1000);
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Connection error: ${error.message}` });
    } finally {
      setUpdating(false);
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-900';
      case 'error': return 'bg-red-50 border-red-200 text-red-900';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      default: return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getDiagnosticStatusColor = (valid: boolean) => {
    return valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Diagnóstico de Instâncias WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Verifique a configuração e atualize as chaves de API das suas instâncias de WhatsApp.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Verificar Instância</CardTitle>
          <CardDescription>Digite o ID da empresa e a chave da instância</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Company ID:</label>
            <Input 
              type="number" 
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="e.g., 31"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Instance Key:</label>
            <Input 
              type="text" 
              value={instanceKey}
              onChange={(e) => setInstanceKey(e.target.value)}
              placeholder="e.g., integrailoja"
            />
          </div>
          
          <Button 
            onClick={handleCheckInstance} 
            disabled={loading || !companyId || !instanceKey}
            className="w-full"
          >
            {loading ? 'Verificando...' : 'Verificar Instância'}
          </Button>
        </CardContent>
      </Card>

      {message && (
        <Card className={`border ${getMessageColor(message.type)}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {message.type === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {message.type === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
              {message.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
              <p>{message.text}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {diagnostic && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Informações da Instância</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">ID</p>
                  <p className="text-lg font-semibold">{diagnostic.instance.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Nome</p>
                  <p className="text-lg font-semibold">{diagnostic.instance.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Instance Key</p>
                  <p className="text-lg font-semibold">{diagnostic.instance.instance_key}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge>{diagnostic.instance.status}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">API Key Comprimento</p>
                  <p className="text-lg font-semibold">{diagnostic.instance.api_key_length}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">API Key (últimos 4)</p>
                  <p className="text-lg font-semibold font-mono">{diagnostic.instance.api_key_last_4}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuração da Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Evolution URL</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">{diagnostic.company.evolution_url}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Evolution Instance</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">{diagnostic.company.evolution_instance}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${getDiagnosticStatusColor(diagnostic.diagnostic.api_key_valid)}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {diagnostic.diagnostic.api_key_valid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Configuração OK
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Problema Detectado
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{diagnostic.diagnostic.problem}</p>
              
              {!diagnostic.diagnostic.api_key_valid && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold">Atualizar API Key</h3>
                  <div>
                    <label className="block text-sm font-medium mb-2">Nova API Key:</label>
                    <Input 
                      type="password" 
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Digite a chave da API do Evolution"
                    />
                  </div>
                  <Button 
                    onClick={handleUpdateApiKey}
                    disabled={updating || !apiKey.trim()}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {updating ? 'Atualizando...' : 'Atualizar API Key'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
