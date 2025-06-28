'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface User {
    id: number;
    name: string;
    email: string;
    password: string;
    is_admin: boolean;
    stripe_customer_id: string | null;
    created_at: string;
}

interface EditingUser {
    id: number;
    name: string;
    email: string;
    password: string;
    is_admin: boolean;
    stripe_customer_id: string;
    created_at: string;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        stripe_customer_id: ''
    });
    const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const { getAdminToken } = useAdminAuth();

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            setUsers(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleEditUser = (user: User) => {
        setEditingUser({
            id: user.id,
            name: user.name,
            email: user.email,
            password: '', // Don't show existing password
            is_admin: user.is_admin,
            stripe_customer_id: user.stripe_customer_id || '',
            created_at: user.created_at
        });
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;

        try {
            const updateData: Record<string, unknown> = {
                id: editingUser.id,
                name: editingUser.name,
                email: editingUser.email,
                stripe_customer_id: editingUser.stripe_customer_id || null,
                created_at: editingUser.created_at
            };

            // Only include password if it's been entered
            if (editingUser.password.trim() !== '') {
                updateData.password = editingUser.password;
            }

            const response = await fetch('/api/admin/users', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update user');
            }

            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update user');
        }
    };

    const handleCreateUser = async () => {
        try {
            if (!newUser.name || !newUser.email || !newUser.password) {
                setError('Name, email, and password are required');
                return;
            }

            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...newUser,
                    stripe_customer_id: newUser.stripe_customer_id || null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create user');
            }

            setIsCreating(false);
            setNewUser({
                name: '',
                email: '',
                password: '',
                stripe_customer_id: ''
            });
            fetchUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create user');
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await fetch(`/api/admin/users?id=${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete user');
            }

            fetchUsers();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete user');
        }
    };

    const toggleSelectUser = (userId: number) => {
        const newSelection = new Set(selectedUsers);
        if (newSelection.has(userId)) {
            newSelection.delete(userId);
        } else {
            newSelection.add(userId);
        }
        setSelectedUsers(newSelection);
        
        // Update select all state
        const selectableUsers = users.filter(user => !user.is_admin);
        setSelectAll(newSelection.size === selectableUsers.length && selectableUsers.length > 0);
    };

    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedUsers(new Set());
            setSelectAll(false);
        } else {
            // Only select non-admin users
            const selectableUserIds = new Set(users.filter(user => !user.is_admin).map(user => user.id));
            setSelectedUsers(selectableUserIds);
            setSelectAll(true);
        }
    };

    const batchDeleteUsers = async () => {
        if (selectedUsers.size === 0) {
            setError('Please select users to delete');
            return;
        }

        // Check if any selected users are admins (this shouldn't happen due to UI logic, but safety check)
        const selectedUserData = users.filter(user => selectedUsers.has(user.id));
        const adminUsers = selectedUserData.filter(user => user.is_admin);
        
        if (adminUsers.length > 0) {
            setError('Cannot delete admin users via batch delete');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedUsers.size} users? This action cannot be undone.`)) {
            return;
        }

        try {
            setLoading(true);
            const response = await fetch('/api/admin/users/batch-delete', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAdminToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userIds: Array.from(selectedUsers) })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to batch delete users');
            }

            setError(null);
            setSelectedUsers(new Set());
            setSelectAll(false);
            fetchUsers(); // Refresh the list
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to batch delete users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        
        // Set up periodic refresh
        const intervalId = setInterval(fetchUsers, REFRESH_INTERVAL);
        
        // Cleanup interval on unmount
        return () => clearInterval(intervalId);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AdminLayout>
            <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Users Management</h2>
                    <div className="flex space-x-3">
                        {selectedUsers.size > 0 && (
                            <button
                                onClick={batchDeleteUsers}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
                                disabled={loading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Selected ({selectedUsers.size})
                            </button>
                        )}
                        <button
                            onClick={() => setIsCreating(true)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                        >
                            Create New User
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center items-center py-8">
                        <div className="flex justify-center items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="ml-2 text-red-800 hover:text-red-900"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Create User Modal */}
                {isCreating && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                            <h3 className="text-lg font-medium mb-4">Create New User</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name *</label>
                                    <input
                                        type="text"
                                        value={newUser.name}
                                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                                    <input
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password *</label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Stripe Customer ID</label>
                                    <input
                                        type="text"
                                        value={newUser.stripe_customer_id}
                                        onChange={(e) => setNewUser({ ...newUser, stripe_customer_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                                    <strong>Note:</strong> New users are created as regular users. Admin privileges cannot be granted via this interface for security reasons.
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateUser}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md"
                                >
                                    Create User
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit User Modal */}
                {editingUser && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                            <h3 className="text-lg font-medium mb-4">Edit User</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">ID (readonly)</label>
                                    <input
                                        type="text"
                                        value={editingUser.id}
                                        disabled
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        value={editingUser.name}
                                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Email</label>
                                    <input
                                        type="email"
                                        value={editingUser.email}
                                        onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">New Password (leave empty to keep current)</label>
                                    <input
                                        type="password"
                                        value={editingUser.password}
                                        onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                        placeholder="Enter new password or leave empty"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Stripe Customer ID</label>
                                    <input
                                        type="text"
                                        value={editingUser.stripe_customer_id}
                                        onChange={(e) => setEditingUser({ ...editingUser, stripe_customer_id: e.target.value })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Created At</label>
                                    <input
                                        type="datetime-local"
                                        value={editingUser.created_at ? new Date(editingUser.created_at).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, created_at: e.target.value ? new Date(e.target.value).toISOString() : editingUser.created_at })}
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Admin Status (readonly)</label>
                                    <input
                                        type="text"
                                        value={editingUser.is_admin ? 'Admin' : 'Regular User'}
                                        disabled
                                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Admin privileges cannot be modified via this interface for security reasons.</p>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveUser}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <input
                                            type="checkbox"
                                            checked={selectAll}
                                            onChange={toggleSelectAll}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stripe ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {!user.is_admin ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.has(user.id)}
                                                    onChange={() => toggleSelectUser(user.id)}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />
                                            ) : (
                                                <span className="text-gray-400 text-xs">Protected</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {user.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.is_admin ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    User
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.stripe_customer_id || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="text-blue-600 hover:text-blue-900 mr-4"
                                            >
                                                Edit
                                            </button>
                                            {!user.is_admin ? (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    Delete
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 text-xs">
                                                    Protected
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {users.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                No users found.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
} 