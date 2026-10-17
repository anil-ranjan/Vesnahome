const SUPABASE_URL = 'https://flhlxxlxncbuvtsfjrnv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qQ1sZKEic6q93X6yGoh6Vg_Uyfj-633';

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let properties = [];
let currentUser = null;
let activeListing = 'All';
let purpose = 'Buy';

const $ = id => document.getElementById(id);


/* =========================================================
   GENERAL
========================================================= */

function toast(message) {
    const element = $('toast');

    if (!element) return;

    element.textContent = message;
    element.classList.add('show');

    setTimeout(() => {
        element.classList.remove('show');
    }, 3200);
}


function closeModal(id) {
    $(id)?.classList.remove('show');
}


function esc(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}


/* =========================================================
   PRICE FORMAT
========================================================= */

function fmt(value, listing = 'Sale') {

    const n = Number(value || 0);

    if (listing === 'Rent') {
        return '₹' + n.toLocaleString('en-IN') + '/month';
    }

    if (n >= 1e7) {
        return '₹' +
            (n / 1e7)
                .toFixed(2)
                .replace(/\.?0+$/, '') +
            ' Cr';
    }

    if (n >= 1e5) {
        return '₹' +
            (n / 1e5)
                .toFixed(2)
                .replace(/\.?0+$/, '') +
            ' Lac';
    }

    return '₹' + n.toLocaleString('en-IN');
}


/* =========================================================
   NORMALIZE PROPERTY
========================================================= */

function norm(p) {

    return {
        id: p.id,

        ownerId: p.owner_id,

        title: p.title || 'Property',

        description: p.description || '',

        propertyType: p.property_type || '',

        listing:
            String(p.purpose).toLowerCase() === 'rent'
                ? 'Rent'
                : 'Sale',

        price: +p.price || 0,

        locality: p.locality || '',

        location:
            p.locality ||
            p.city ||
            p.address ||
            '',

        bedrooms: p.bedrooms ?? '',

        bathrooms: p.bathrooms ?? '',

        area: p.area ?? '',

        areaUnit: p.area_unit || 'sq_ft',

        youtubeUrl: p.youtube_url || '',

        contactName: p.owner_name || '',

        phone: p.phone || '',

        listedBy: p.listed_by || 'agent',

        images: p.images || [],

        imageUrl: p.imageUrl || ''
    };
}


/* =========================================================
   PROPERTY IMAGES
========================================================= */

async function imagesFor(property) {

    if (!property.owner_id || !property.id) {
        return [];
    }

    const folder =
        `${property.owner_id}/${property.id}`;

    const { data, error } =
        await supabaseClient.storage
            .from('property-images')
            .list(folder, {
                limit: 100
            });

    if (error) {
        console.warn(
            'Could not load images for property:',
            property.id,
            error.message
        );

        return [];
    }

    return (data || [])

        .filter(file =>
            file.name &&
            !file.name.startsWith('.')
        )

        .map(file => {

            return supabaseClient.storage
                .from('property-images')
                .getPublicUrl(
                    `${folder}/${file.name}`
                )
                .data.publicUrl;

        });
}


/* =========================================================
   LOAD PROPERTIES
========================================================= */

async function loadProperties() {

    const { data, error } =
        await supabaseClient
            .from('properties')
            .select('*')
            .eq('status', 'active')
            .order('created_at', {
                ascending: false
            });

    if (error) {

        console.error(
            'Property loading error:',
            error
        );

        toast(error.message);

        return;
    }

    console.log(
        'Active properties returned from Supabase:',
        data
    );

    const rows =
        await Promise.all(

            (data || []).map(
                async property => {

                    const images =
                        await imagesFor(property);

                    return {
                        ...property,
                        images,
                        imageUrl:
                            images[0] || ''
                    };
                }
            )

        );

    properties = rows.map(norm);

    console.log(
        'Properties loaded:',
        properties.length
    );

    render();
}


/* =========================================================
   YOUTUBE
========================================================= */

function ytId(url) {

    try {

        const parsedUrl = new URL(url);

        const host =
            parsedUrl.hostname
                .replace(/^www\./, '');

        let videoId = '';

        if (host === 'youtu.be') {

            videoId =
                parsedUrl.pathname
                    .split('/')[1];

        } else if (
            parsedUrl.pathname === '/watch'
        ) {

            videoId =
                parsedUrl.searchParams
                    .get('v');

        } else if (
            parsedUrl.pathname
                .startsWith('/shorts/')
            ||
            parsedUrl.pathname
                .startsWith('/embed/')
        ) {

            videoId =
                parsedUrl.pathname
                    .split('/')[2];

        }

        return videoId || '';

    } catch {

        return '';

    }
}


/* =========================================================
   LISTED BY
========================================================= */

function listedByLabel(value) {

    if (value === 'agent') {
        return 'Broker / Agent';
    }

    if (value === 'builder') {
        return 'Builder / Developer';
    }

    if (value === 'owner') {
        return 'Owner';
    }

    return 'Contact';
}


/* =========================================================
   LISTING MEDIA
========================================================= */

function media(property) {

    const videoId =
        ytId(property.youtubeUrl);

    if (videoId) {

        return `
            <div
                class="listing-media"
                onclick="viewProperty(${property.id})"
            >

                <img
                    src="https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg"
                    alt="Property video"
                >

                <b>
                    VIDEO TOUR
                </b>

                <i>
                    ▶
                </i>

                <small>
                    Play on VesnaHome
                </small>

            </div>
        `;
    }


    if (property.imageUrl) {

        return `
            <div
                class="listing-media"
                onclick="viewProperty(${property.id})"
            >

                <img
                    src="${esc(property.imageUrl)}"
                    alt="${esc(property.title)}"
                >

                <b>
                    ${property.images.length} PHOTOS
                </b>

            </div>
        `;
    }


    return `
        <div class="listing-media no-media">
            No media
        </div>
    `;
}


/* =========================================================
   RENDER PROPERTIES
========================================================= */

function render(list = properties) {

    const grid =
        $('propertyGrid');

    if (!grid) return;


    if ($('resultCount')) {

        $('resultCount').textContent =
            `${list.length} ${
                list.length === 1
                    ? 'property'
                    : 'properties'
            } found`;

    }


    grid.innerHTML =
        list.map(property => {

            const digits =
                String(property.phone || '')
                    .replace(/\D/g, '');


            return `

                <article class="listing-row">

                    ${media(property)}


                    <div class="listing-content">

                        <span>
                            FOR ${property.listing.toUpperCase()}
                        </span>

                        <h3>
                            ${esc(property.title)}
                        </h3>

                        <p>
                            ⌖ ${esc(property.location)}
                        </p>


                        <div class="specs">

                            <div>
                                AREA

                                <strong>
                                    ${property.area}
                                    ${esc(property.areaUnit)}
                                </strong>
                            </div>


                            <div>
                                CONFIGURATION

                                <strong>
                                    ${property.bedrooms} BHK
                                </strong>
                            </div>


                            <div>
                                BATHROOM

                                <strong>
                                    ${property.bathrooms}
                                </strong>
                            </div>


                            <div>
                                PROPERTY TYPE

                                <strong>
                                    ${esc(property.propertyType)}
                                </strong>
                            </div>

                        </div>


                        <p>
                            ${
                                esc(property.description)
                                    .slice(0, 210)
                            }
                        </p>


                        <div class="actions">

                            <button
                                onclick="viewProperty(${property.id})"
                            >
                                View full details
                            </button>


                            ${
                                currentUser &&
                                property.ownerId ===
                                    currentUser.id

                                    ? `

                                    <button
                                        onclick="openEdit(${property.id})"
                                    >
                                        ✎ Edit Property
                                    </button>

                                    `

                                    : ''
                            }

                        </div>

                    </div>


                    <aside>

                        <h2>
                            ${
                                fmt(
                                    property.price,
                                    property.listing
                                )
                            }
                        </h2>


                        ${
                            digits

                                ? `

                                <div class="phone">

                                    <small>
                                        MOBILE
                                    </small>

                                    <strong>
                                        ${esc(property.phone)}
                                    </strong>

                                </div>


                                <a href="tel:${digits}">
                                    Call
                                </a>


                                <a
                                    href="https://wa.me/${digits}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    WhatsApp
                                </a>

                                `

                                : ''
                        }


                        <p>

                            ${listedByLabel(property.listedBy)}:

                            <b>
                                ${esc(property.contactName)}
                            </b>

                        </p>

                    </aside>

                </article>

            `;

        }).join('')

        ||

        '<p>No active properties found.</p>';
}


/* =========================================================
   PROPERTY DETAILS
========================================================= */

function viewProperty(id) {

    const property =
        properties.find(
            item => item.id === id
        );

    if (!property) return;


    const videoId =
        ytId(property.youtubeUrl);


    $('detailsContent').innerHTML = `

        <h2>
            ${esc(property.title)}
        </h2>

        <h3>
            ${
                fmt(
                    property.price,
                    property.listing
                )
            }
        </h3>

        <p>
            ${esc(property.description)}
        </p>


        ${
            videoId

                ? `

                <iframe
                    class="video"
                    src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0"
                    allowfullscreen
                ></iframe>

                `

                : ''
        }

    `;


    $('detailsModal')
        .classList.add('show');
}


/* =========================================================
   AUTHENTICATION
========================================================= */

async function updateAuthUI() {

    const {
        data: {
            session
        }
    } =
        await supabaseClient.auth
            .getSession();


    currentUser =
        session?.user || null;


    if ($('guestActions')) {

        $('guestActions').style.display =
            currentUser
                ? 'none'
                : 'block';

    }


    if ($('userActions')) {

        $('userActions').style.display =
            currentUser
                ? 'flex'
                : 'none';

    }


    if ($('userEmail')) {

        $('userEmail').textContent =
            currentUser?.email || '';

    }


    if (properties.length) {
        render();
    }
}


function openAuth() {

    $('authModal')
        .classList.add('show');

}


function showLogin() {

    $('loginForm').style.display =
        'flex';

    $('signupForm').style.display =
        'none';

}


function showSignup() {

    $('loginForm').style.display =
        'none';

    $('signupForm').style.display =
        'flex';

}


/* =========================================================
   LOGIN
========================================================= */

$('loginForm').onsubmit =
    async event => {

        event.preventDefault();


        const form =
            new FormData(event.target);


        const { error } =
            await supabaseClient.auth
                .signInWithPassword({

                    email:
                        form.get('email'),

                    password:
                        form.get('password')

                });


        if (error) {

            toast(error.message);

            return;
        }


        closeModal('authModal');

        event.target.reset();

        await updateAuthUI();

        await loadProperties();
    };


/* =========================================================
   SIGN UP
========================================================= */

$('signupForm').onsubmit =
    async event => {

        event.preventDefault();


        const form =
            new FormData(event.target);


        if (
            form.get('password')
            !==
            form.get('confirmPassword')
        ) {

            toast(
                'Passwords do not match'
            );

            return;
        }


        const { error } =
            await supabaseClient.auth
                .signUp({

                    email:
                        form.get('email'),

                    password:
                        form.get('password'),

                    options: {

                        emailRedirectTo:
                            'https://vesnahome.in'

                    }

                });


        if (error) {

            toast(error.message);

            return;
        }


        toast(
            'Check your email to confirm account'
        );
    };


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    await supabaseClient.auth
        .signOut();

    await updateAuthUI();

    await loadProperties();
}


/* =========================================================
   OPEN POST PROPERTY
========================================================= */

async function openPost() {

    if (!currentUser) {

        openAuth();

        return;
    }

    $('postModal')
        .classList.add('show');
}


/* =========================================================
   UPLOAD PHOTOS
========================================================= */

async function uploadPhotos(
    userId,
    propertyId,
    files
) {

    for (const file of files) {

        const safeFilename =
            file.name.replace(
                /[^\w.-]/g,
                '_'
            );


        const path =
            `${userId}/${propertyId}/${Date.now()}-${safeFilename}`;


        const { error } =
            await supabaseClient.storage
                .from('property-images')
                .upload(path, file);


        if (error) {

            throw error;

        }
    }
}


/* =========================================================
   POST PROPERTY
   NO REVIEW - PUBLISH AUTOMATICALLY
========================================================= */

$('postForm').onsubmit =
    async event => {

        event.preventDefault();


        const form =
            new FormData(event.target);


        const {
            data: {
                session
            }
        } =
            await supabaseClient.auth
                .getSession();


        const user =
            session?.user;


        if (!user) {

            toast(
                'Please log in to post a property'
            );

            return;
        }


        const contactName =
            form.get('contactName')
            ||
            form.get('owner')
            ||
            '';


        const row = {

            title:
                form.get('title'),

            description:
                form.get('description')
                || '',

            property_type:
                form.get('propertyType'),

            purpose:
                String(
                    form.get('listingType')
                ).toLowerCase(),

            price:
                Number(
                    form.get('price')
                ),

            locality:
                form.get('location'),

            bedrooms:
                Number(
                    form.get('bhk')
                ),

            bathrooms:
                form.get('bathrooms')
                    ? Number(
                        form.get('bathrooms')
                    )
                    : null,

            area:
                Number(
                    form.get('area')
                ),

            area_unit:
                'sq_ft',

            youtube_url:
                form.get('youtube')
                || null,

            owner_name:
                contactName,

            phone:
                form.get('phone'),

            listed_by:
                form.get('listedBy')
                || 'agent',

            owner_id:
                user.id,

            status:
                'active',

            featured:
                false
        };


        const {
            data,
            error
        } =
            await supabaseClient
                .from('properties')
                .insert(row)
                .select('id')
                .single();


        if (error) {

            console.error(
                'Property insert error:',
                error
            );

            toast(error.message);

            return;
        }


        /* Upload selected photos */

        try {

            const files =
                $('propertyPhotos')
                    ?.files
                    ? [
                        ...$('propertyPhotos')
                            .files
                    ]
                    : [];


            if (files.length) {

                await uploadPhotos(
                    user.id,
                    data.id,
                    files
                );

            }

        } catch (uploadError) {

            console.error(
                'Photo upload error:',
                uploadError
            );

            /*
             Property has already been successfully
             created, so don't hide the listing just
             because one photo upload failed.
            */

            toast(
                'Property published, but some photos could not be uploaded'
            );

            closeModal('postModal');

            event.target.reset();

            await loadProperties();

            return;
        }


        closeModal('postModal');

        event.target.reset();


        toast(
            'Property published successfully'
        );


        /*
         Reload immediately.
         No manual refresh or Supabase status change.
        */

        await loadProperties();
    };


/* =========================================================
   EDIT PROPERTY
========================================================= */

function openEdit(id) {

    const property =
        properties.find(
            item => item.id === id
        );


    if (
        !property ||
        property.ownerId !==
            currentUser?.id
    ) {

        toast(
            'You can edit only your property'
        );

        return;
    }


    const values = {

        editPropertyId:
            property.id,

        editListingType:
            property.listing
                .toLowerCase(),

        editPropertyType:
            property.propertyType,

        editTitle:
            property.title,

        editLocation:
            property.locality,

        editPrice:
            property.price,

        editBhk:
            property.bedrooms,

        editBathrooms:
            property.bathrooms,

        editArea:
            property.area,

        editListedBy:
            property.listedBy,

        editContactName:
            property.contactName,

        editOwner:
            property.contactName,

        editPhone:
            property.phone,

        editYoutube:
            property.youtubeUrl,

        editDescription:
            property.description
    };


    for (
        const [elementId, value]
        of Object.entries(values)
    ) {

        const element =
            $(elementId);

        if (element) {

            element.value =
                value ?? '';

        }
    }


    $('editModal')
        .classList.add('show');
}


/* =========================================================
   SAVE EDITED PROPERTY
========================================================= */

$('editForm').onsubmit =
    async event => {

        event.preventDefault();


        const form =
            new FormData(event.target);


        const {
            data: {
                session
            }
        } =
            await supabaseClient.auth
                .getSession();


        const user =
            session?.user;


        if (!user) {

            toast(
                'Please log in'
            );

            return;
        }


        const propertyId =
            Number(
                form.get('propertyId')
            );


        const contactName =
            form.get('contactName')
            ||
            form.get('owner')
            ||
            '';


        const update = {

            title:
                form.get('title'),

            description:
                form.get('description')
                || null,

            property_type:
                form.get('propertyType'),

            purpose:
                String(
                    form.get('listingType')
                ).toLowerCase(),

            price:
                Number(
                    form.get('price')
                ),

            locality:
                form.get('location'),

            bedrooms:
                Number(
                    form.get('bhk')
                ),

            bathrooms:
                form.get('bathrooms')
                    ? Number(
                        form.get('bathrooms')
                    )
                    : null,

            area:
                Number(
                    form.get('area')
                ),

            youtube_url:
                form.get('youtube')
                || null,

            owner_name:
                contactName,

            phone:
                form.get('phone'),

            listed_by:
                form.get('listedBy')
                || 'agent',

            status:
                'active'
        };


        const { error } =
            await supabaseClient
                .from('properties')
                .update(update)
                .eq(
                    'id',
                    propertyId
                )
                .eq(
                    'owner_id',
                    user.id
                );


        if (error) {

            toast(error.message);

            return;
        }


        try {

            const files =
                $('editPropertyPhotos')
                    ?.files
                    ? [
                        ...$('editPropertyPhotos')
                            .files
                    ]
                    : [];


            if (files.length) {

                await uploadPhotos(
                    user.id,
                    propertyId,
                    files
                );

            }

        } catch (uploadError) {

            console.error(
                'Photo upload error:',
                uploadError
            );

            toast(
                'Property updated, but some photos could not be uploaded'
            );

            closeModal('editModal');

            await loadProperties();

            return;
        }


        closeModal('editModal');

        toast(
            'Property updated successfully'
        );

        await loadProperties();
    };


/* =========================================================
   FILTERS
========================================================= */

function applyFilters() {

    const filtered =
        properties.filter(property => {

            const locationMatches =
                !$('location').value
                ||
                property.location ===
                    $('location').value;


            const typeMatches =
                !$('type').value
                ||
                property.propertyType ===
                    $('type').value;


            const budgetMatches =
                !$('budget').value
                ||
                property.price <=
                    Number(
                        $('budget').value
                    );


            const bhkMatches =
                !$('bhk').value
                ||
                String(
                    property.bedrooms
                ) ===
                    $('bhk').value;


            return (
                locationMatches &&
                typeMatches &&
                budgetMatches &&
                bhkMatches
            );
        });


    render(filtered);
}


function resetFilters() {

    [
        'location',
        'type',
        'budget',
        'bhk'
    ].forEach(id => {

        if ($(id)) {
            $(id).value = '';
        }

    });


    render();
}


/* =========================================================
   SALE / RENT FILTER PILLS
========================================================= */

document
    .querySelectorAll(
        '.filter-pills button'
    )
    .forEach(button => {

        button.onclick = () => {

            document
                .querySelectorAll(
                    '.filter-pills button'
                )
                .forEach(item => {

                    item.classList
                        .remove('active');

                });


            button.classList
                .add('active');


            if (
                button.dataset.filter ===
                'All'
            ) {

                render(properties);

            } else {

                render(
                    properties.filter(
                        property =>
                            property.listing ===
                            button.dataset.filter
                    )
                );

            }
        };

    });


/* =========================================================
   CLOSE MODAL BY CLICKING BACKGROUND
========================================================= */

window.onclick =
    event => {

        if (
            event.target.classList
                .contains('modal')
        ) {

            event.target.classList
                .remove('show');

        }
    };


/* =========================================================
   INITIAL LOAD
========================================================= */

(async () => {

    await updateAuthUI();

    await loadProperties();

})();