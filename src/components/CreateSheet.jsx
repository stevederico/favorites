import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getCookie, getBackendURL } from '@stevederico/skateboard-ui/Utilities';

export default function CreateSheet({ open, setOpen, onSuccess }) {
  const [formData, setFormData] = useState({
    venue: '',
    notes: '',
    address: '',
    gps: ''
  });

  async function createFavorite(e) {
    e.preventDefault();
    try {
      const response = await fetch(`${getBackendURL()}/favorites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getCookie('token')}`,
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setOpen(false);
        setFormData({ venue: '', notes: '', address: '', gps: '' });
        onSuccess();
      } else {
        console.error("Failed to create favorite");
      }
    } catch (error) {
      console.error("Error creating favorite:", error);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-md bg-background p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold mb-4">Add New Favorite</Dialog.Title>
          
          <form onSubmit={createFavorite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Venue Name</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({...formData, venue: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full p-2 border rounded"
                rows="3"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">GPS Coordinates (lat, lng)</label>
              <input
                type="text"
                value={formData.gps}
                onChange={(e) => setFormData({...formData, gps: e.target.value})}
                className="w-full p-2 border rounded"
                placeholder="e.g. 36.1699, -115.1398"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}