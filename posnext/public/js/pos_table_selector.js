frappe.provide('posnext.PointOfSale');

posnext.PointOfSale.TableSelector = class {
    constructor({ wrapper, events, pos_profile }) {
        console.log('Wrapper check:', wrapper, wrapper.length, wrapper.is(':visible'));
        if (!wrapper || !wrapper.length) {
            console.error('Invalid wrapper: Element not found or not provided');
            return;
        }
        this.wrapper = wrapper;
        this.events = events;
        this.pos_profile = pos_profile;
        this.selected_table = null;
        this.init_component();
    }

    init_component() {
        this.prepare_dom();
        this.load_tables();
        this.bind_events();
    }

    prepare_dom() {
        this.wrapper.html(`
            <style>
                .table-selector {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    width: 90vw; /* Wider layout, 90% of viewport width */
                    max-width: 1200px; /* Cap width for very large screens */
                    margin: 0 auto; /* Center the container */
                    padding: 16px;
                    background: #f9fafb;
                    font-family: 'Inter', sans-serif;
                    box-sizing: border-box;
                }

                .table-selector-header {
                    text-align: center;
                    margin-bottom: 24px;
                    position: relative;
                }

                .header-actions {
                    position: absolute;
                    top: 0;
                    right: 0;
                }

                .order-list-btn {
                    font-size: 0.875rem;
                    padding: 6px 12px;
                }

                .restaurant-title {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: #1f2a44;
                    margin: 0;
                }

                .restaurant-subtitle {
                    font-size: 0.875rem;
                    color: #4CAF50;
                    margin: 4px 0 0;
                }

                .table-search-container {
                    max-width: 400px; /* Slightly wider search bar */
                    margin: 0 auto 24px;
                    position: relative;
                }

                .table-search-input {
                    width: 100%;
                    padding: 8px 36px 8px 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    color: #1f2a44;
                    transition: border-color 0.2s;
                }

                .table-search-input:focus {
                    border-color: #4CAF50;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
                }

                .table-search-input::placeholder {
                    color: #9ca3af;
                }

                .search-icon {
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #9ca3af;
                    font-size: 0.875rem;
                }

                .table-grid {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(160px, 1fr)); /* Wider columns */
                    grid-template-rows: repeat(5, minmax(0, auto));
                    gap: 16px;
                    max-height: calc(5 * (110px + 16px)); /* Adjusted for 5 rows */
                    overflow-y: auto;
                    padding: 8px 0;
                    scrollbar-width: thin;
                }

                .table-card {
                    background: #fff;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
                    min-height: 110px; /* Slightly taller for wider layout */
                    visibility: visible;
                }

                .table-card.available {
                    border-color: #4CAF50;
                    background: linear-gradient(135deg, #4CAF50, #6cc070);
                    color: #fff;
                }

                .table-card.occupied-with-orders {
                    border-color: #f59e0b;
                    background: linear-gradient(135deg, #f59e0b, #fbbf24);
                    color: #fff;
                }

                .table-card.occupied-urgent {
                    border-color: #dc2626;
                    background: linear-gradient(135deg, #dc2626, #ef4444);
                    color: #fff;
                }

                .table-card.empty {
                    border-color: #4CAF50;
                    background: #fff;
                    color: #4CAF50;
                }

                .table-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .table-card.selected {
                    border-color: #2563eb;
                    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
                }

                .table-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .table-name {
                    font-size: 1rem;
                    font-weight: 600;
                    margin: 0;
                }

                .table-time {
                    font-size: 0.75rem;
                    opacity: 0.9;
                    margin: 0;
                }

                .table-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .order-status {
                    font-size: 0.75rem;
                    font-weight: 500;
                    margin: 0;
                }

                .table-details {
                    font-size: 0.6875rem;
                    opacity: 0.8;
                    margin: 0;
                }

                .table-card.empty .table-time {
                    display: none;
                }

                .table-selector-footer {
                    text-align: center;
                    padding-top: 16px;
                    margin-top: 16px;
                    border-top: 1px solid #e5e7eb;
                }

                .proceed-btn {
                    padding: 8px 16px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    border-radius: 6px;
                    border: none;
                    background: #4CAF50;
                    color: #fff;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .proceed-btn:hover:not(:disabled) {
                    background: #3d8b40;
                }

                .proceed-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .no-tables {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 32px;
                    color: #6b7280;
                    font-size: 0.875rem;
                }

                .no-tables i {
                    font-size: 1.5rem;
                    margin-bottom: 8px;
                    opacity: 0.5;
                }

                .table-card-skeleton {
                    background: #fff;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    animation: pulse 1.5s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.7; }
                    50% { opacity: 1; }
                }

                .skeleton-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                .skeleton-text {
                    background: #e5e7eb;
                    border-radius: 4px;
                }

                .skeleton-text.large { width: 60px; height: 16px; }
                .skeleton-text.medium { width: 40px; height: 16px; }
                .skeleton-text.small { width: 80px; height: 12px; margin-top: 4px; }

                @media (max-width: 768px) {
                    .table-selector {
                        padding: 12px;
                        width: 100%; /* Full width on smaller screens */
                        max-width: none;
                    }

                    .restaurant-title {
                        font-size: 1.25rem;
                    }

                    .restaurant-subtitle {
                        font-size: 0.75rem;
                    }

                    .table-grid {
                        grid-template-columns: repeat(4, minmax(140px, 1fr));
                        gap: 12px;
                    }

                    .table-card {
                        padding: 10px;
                        min-height: 90px;
                    }

                    .table-name {
                        font-size: 0.875rem;
                    }

                    .table-time, .order-status {
                        font-size: 0.6875rem;
                    }

                    .table-details {
                        font-size: 0.625rem;
                    }
                }

                @media (max-width: 480px) {
                    .table-grid {
                        grid-template-columns: repeat(2, minmax(120px, 1fr));
                        gap: 8px;
                    }

                    .table-card {
                        padding: 8px;
                        min-height: 80px;
                    }
                }
            </style>
            <div class="table-selector">
                <div class="table-selector-header">
                    <div class="header-actions">
                        <button class="btn btn-secondary btn-sm order-list-btn">
                            <i class="fa fa-list"></i> ${__('Order List')}
                        </button>
                    </div>
                    <h1 class="restaurant-title">${__('Table Selection')}</h1>
                    <p class="restaurant-subtitle">${__('Choose a table to start taking orders')}</p>
                </div>
                <div class="table-search-container">
                    <input type="text" class="table-search-input" placeholder="${__('Search tables...')}" />
                    <i class="fa fa-search search-icon"></i>
                </div>
                <div class="table-grid"></div>
                <div class="table-selector-footer">
                    <button class="btn btn-primary btn-sm proceed-btn" disabled aria-label="${__('Proceed to order for selected table')}">
                        ${__('Proceed to Order')}
                    </button>
                </div>
            </div>
        `);
    }

    load_tables() {
        const $grid = this.wrapper.find('.table-grid');
        $grid.empty();
        this.show_loading_skeleton();

        frappe.call({
            method: 'posnext.posnext.page.posnext.point_of_sale.get_tables',
            callback: (r) => {
                console.log('frappe.call response:', r);
                $grid.empty();
                if (r.exc) {
                    frappe.msgprint(__('Error loading tables. Please try again.'));
                    this.render_tables([]);
                } else {
                    this.all_tables = r.message || [];
                    this.render_tables(this.all_tables);
                }
            }
        });
    }

    show_loading_skeleton() {
        const $grid = this.wrapper.find('.table-grid');
        for (let i = 0; i < 6; i++) {
            $grid.append(`
                <div class="table-card-skeleton">
                    <div class="skeleton-header">
                        <div class="skeleton-text large"></div>
                        <div class="skeleton-text medium"></div>
                    </div>
                    <div class="skeleton-text small"></div>
                </div>
            `);
        }
    }

    render_tables(tables) {
        console.log('Rendering tables:', tables);
        const $grid = this.wrapper.find('.table-grid');
        $grid.empty();

        if (!tables.length) {
            $grid.append(`
                <div class="no-tables">
                    <i class="fa fa-table"></i>
                    <p>${__('No tables available')}</p>
                    <small>${__('Please check back later')}</small>
                </div>
            `);
            return;
        }

        tables.forEach(table => {
            const minutes = table.elapsed_time ? parseInt(table.elapsed_time.split(':')[0]) : 0;
            const statusClass = table.status === 'Available' ? 'empty' :
                minutes >= 8 ? 'occupied-urgent' :
                minutes >= 4 ? 'occupied-with-orders' : 'available';
            const orderText = table.status === 'Available' ? 'No Order' : `Ordered ${table.order_count || 0} items`;

            $grid.append(`
                <div class="table-card ${statusClass} ${this.selected_table === table.name ? 'selected' : ''}"
                     data-table="${table.name}" 
                     tabindex="0" 
                     role="button" 
                     aria-label="${__('Table')} ${table.table_name}, ${orderText}">
                    <div class="table-header">
                        <h3 class="table-name">${table.table_name}</h3>
                        ${table.elapsed_time ? `<p class="table-time">${table.elapsed_time}</p>` : ''}
                    </div>
                    <div class="table-info">
                        <p class="order-status">${orderText}</p>
                        <p class="table-details">${__('Capacity')}: ${table.seating_capacity} ${__('seats')}</p>
                    </div>
                </div>
            `);
        });
        console.log('Table cards appended:', $grid.find('.table-card').length);
    }

    filter_tables(searchTerm) {
        if (!this.all_tables) return;
        const filteredTables = searchTerm ?
            this.all_tables.filter(table =>
                table.table_name.toLowerCase().includes(searchTerm) ||
                table.seating_capacity.toString().includes(searchTerm) ||
                table.status.toLowerCase().includes(searchTerm)
            ) : this.all_tables;
        console.log('Filtered tables:', filteredTables);
        this.render_tables(filteredTables);
    }

    bind_events() {
        const me = this;

        this.wrapper.on('input', '.table-search-input', frappe.utils.debounce(function() {
            const searchTerm = $(this).val().toLowerCase().trim();
            me.filter_tables(searchTerm);
        }, 300));

        this.wrapper.on('click', '.table-card', function() {
            me.wrapper.find('.table-card').removeClass('selected');
            $(this).addClass('selected');
            me.selected_table = $(this).data('table');
            me.wrapper.find('.proceed-btn').prop('disabled', false);
        });

        this.wrapper.on('keydown', '.table-card', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                $(this).click();
            }
        });

        this.wrapper.on('click', '.proceed-btn', function() {
            if (me.selected_table) {
                me.events.table_selected?.(me.selected_table);
            }
        });

        this.wrapper.on('click', '.order-list-btn', function() {
            me.events.toggle_recent_order?.();
        });
    }

    get_selected_table() {
        return this.selected_table;
    }

    toggle_component(show) {
        if (show) {
            this.wrapper.show();
        } else {
            this.wrapper.hide();
        }
    }
};