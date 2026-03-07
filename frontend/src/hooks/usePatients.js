import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
 
// Hook para obtener lista de pacientes
export function usePatients() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/patients/');
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache válido por 5 minutos
  });
}
 
// Hook para crear un paciente
export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patientData) => apiClient.post('/patients/', patientData),
    onSuccess: () => {
      // Invalida el cache para refrescar la lista
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

