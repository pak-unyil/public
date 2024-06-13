
    document.addEventListener('alpine:init', () => {
      gsap.registerPlugin(Flip,ScrollTrigger,Draggable)

      Alpine.store('temp', { items:[], init(){ temp=this } })
      Alpine.store('html', { items:[], init(){ html=this } })
      Alpine.store('data', { items:[], init(){ data=this } })
      Alpine.store('posts', { items:[], init(){ posts=this.items } })
      Alpine.store('users', { items:[], init(){ users=this.items } })
      Alpine.store('comments', { items:[], init(){ comments=this.items } })
      Alpine.store('res', { items:[], init(){ res=this.items } })
       
      Alpine.store('app', {
        url             : null,
        theme           : null,
        templateKey     : 'home',
        template        : [],
        cart            : {},
        wishlist        : {},
        categories      : null,
        tags            : null,
        archiveMonth    : null,
        wpAdminBarHeight: 0,

        async init(){ 
          app = this
          
          // wpAdminBar
          setTimeout(()=>{
            app.wpAdminBarHeight = document.getElementById('wpadminbar')?.offsetHeight ?? 0
          }, 500)
          
        },
      })

      Alpine.directive("destroy", (el, { expression }, { evaluateLater, cleanup }) => {
        const onDestroy = evaluateLater(expression);
        cleanup(onDestroy);
      });

    })

    window.addEventListener('popstate', e=>{
      app.template = []
      setTimeout(()=>{
        app.template = urlToTemplate(location.href)
      }, 50)
    })

    async function ajax(e){
      let url    = e.target.closest('[href]')?.href
      let href   = e.target.closest('[href]')?.getAttribute('href')
      let target = e.target.closest('[href]')?.getAttribute('target')
      let home   = ctx.home.slice(0,-1)
      if(!url || !url.startsWith(home) || url.hash || target=='_blank') return;

      // prevent
      e.preventDefault()

      // stop if same url or url=='#'
      if(url==location.href || href=='#') return;

      // push state
      history.pushState(null, '', url)
      
      // setup page
      app.template = []
      setTimeout(()=>{
        app.template = urlToTemplate(url)
      }, 50)
      scrollTo(0,0)
    }

    async function relatedPost(postid, arg){
      let categories = posts[postid].categories.join()
      let tags       = posts[postid].tags.join()
      let url        = ctx.root+'wp/v2/posts?exclude='+postid+'&amp;categories='+categories+(tags&amp;&amp;'&amp;tags='+tags)+'&amp;per_page='+arg.perPage+'&amp;_embed&amp;_fields=id'
      let key        = btoa(url)
      if(!res[key]){
        res[key] = await fetch(url).then(res=>res.json()).then(res=>res.map(item=>item.id))
        for(let item of res[key]){
          await getPost(item)
        }
      }
      return res[key].map(id=>posts[id])
    }

    async function popularPost(arg){
      let url = ctx.root+'wp/v2/posts?per_page='+arg.perPage+'&amp;_fields=id&amp;orderby=view'
      let key = btoa(url)
      if(!res[key]){
        res[key] = await fetch(url).then(res=>res.json()).then(res=>res.map(item=>item.id))
        await getPosts(res[key])
        console.log('fetch popular post')
      }
      return res[key].map(id=>posts[id])
    }

    async function latestPost(arg){
      let url = ctx.root+'wp/v2/posts?per_page='+arg.perPage+'&amp;page='+arg.page+'&amp;_fields=id'
      let key = btoa(url)
      if(!res[key]){
        res[key] = await fetch(url).then(res=>res.json()).then(res=>res.map(item=>item.id))
        console.log('fetch latestPost')
        let resFiltered = res[key].filter(id=>!posts[id])
        await getPosts(resFiltered)
      }
      return res[key].map(id=>posts[id])
    }

    async function latestProduct(arg){
      arg.loading=true
      let url = ctx.root+'wp/v2/product?per_page='+arg.perPage+'&amp;page='+arg.page+'&amp;_fields=id'
      let key = btoa(url)
      if(!res[key]){
        res[key] = await fetch(url).then(res=>res.json()).then(res=>res.map(item=>item.id))
        for(let item of res[key]){
          await getProduct(item)
        }
      }
      arg.loading=false
      return res[key].map(id=>posts[id])
    }

    async function getCart(){
      if(Object.keys(app.cart).length===0){
        app.cart = await fetch(ctx.root+'wc/store/cart').then(res=>res.json())
        console.log('fetch cart')
      }
      return app.cart
    }

    async function getCategories(){
      if(!app.categories){
        app.categories = await fetch(ctx.root+'wp/v2/categories').then(res=>res.json())
      }
      return app.categories
    }

    async function getTags(){
      if(!app.tags){
        app.tags = await fetch(ctx.root+'wp/v2/tags').then(res=>res.json())
      }
      return app.tags
    }

    async function getArchiveMonth(){
      if(!app.archiveMonth){
        app.archiveMonth = await fetch(ctx.root+'blazee/v1/archive-month').then(res=>res.json())
      }
      return app.archiveMonth
    }

    async function getSections(ids){ // ids = sectionName
      let idsFiltered = ids.filter(id=>!html[id])
      if(idsFiltered.length>0){
        let url = ctx.root+'blazee/v1/sections/'+idsFiltered.join()+'?_wpnonce='+ctx.nonce
        let res = await fetch(url).then(res=>res.json())
        for(const key in res.data) data[key] = res.data[key]
        for(const key in res.html) html[key] = res.html[key]
        console.log('fetch section '+idsFiltered.join())
      }
      return ids.map(id=>html[id]).join('')
    }

    async function getPost(id){
      if(!posts[id]){
        let url = ctx.root+'wp/v2/posts/'+id+'?_embed&amp;_wpnonce='+ctx.nonce
        posts[id] = await fetch(url).then(res=>res.json())
        console.log('fetch post '+id)
      }
      return posts[id]
    }

    async function getPosts(ids){
      let idsFiltered = ids.filter(id=>!posts[id])
      if(idsFiltered.length>0){
        let url = ctx.root+'wp/v2/posts?_embed&amp;_wpnonce='+ctx.nonce+'&amp;include='+idsFiltered.join()
        await fetch(url).then(res=>res.json()).then(res=>res.forEach(item=>posts.push(item)))
        console.log('fetch posts '+idsFiltered.join())
      }
      return ids.map(id=>posts[id])
    }

    async function getPostByUrl(url){
      let post = posts.find(item=>{ return item.link==url || item.link==url+'/' })
      if(!post){
        url = new URL(url);
        url.searchParams.append('json', true);
        let key = btoa(url.href)
        if(!res[key]){
          res[key] = await fetch(url.href).then(res=>res.json())
          console.log('fetch post by url '+url.href)
        }
        res[key].rest_posts.forEach(item=>{
          posts.push(item)
          post = item
        })
      }
      return [post]
    }

    async function getPage(id){
      if(!posts[id]){
        let url = ctx.root+'wp/v2/pages/'+id+'?_embed&amp;_wpnonce='+ctx.nonce
        posts[id] = await fetch(url).then(res=>res.json())
      }
      return posts[id]
    }

    async function getProduct(id){
      if(!posts[id]){
        let url = ctx.root+'wc/store/products/'+id
        posts[id] = await fetch(url).then(res=>res.json())
      }
      return posts[id]
    }

    async function saveData(id){
        temp[id].saving = true
        let url       = ctx.root+'blazee/v1/data/'+id+'?_wpnonce='+ctx.nonce
        let res       = await fetch(url, { method:'post', body:JSON.stringify(temp[id]) }).then(res=>res.json()) // save to db
        data[id]      = updateObj(temp[id])  // update data
        temp['toast'] = res // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        temp[id].saving = false
    }

    async function addToCart(id, quantity=1){
      return await fetch(ctx.root+'wc/store/cart/add-item', {
        method: 'POST',
        headers: {
          'X-WC-Store-API-Nonce': ctx.nonceWoo,
          'Content-type': 'application/json'
        },
        body: JSON.stringify({
          id:id,
          quantity:quantity
        })
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = {message:'Added to Cart', type:'success'} // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }

    async function addToWishlist(id){
      await fetch(ctx.root+'blazee/v1/wishlist/'+id+'?_wpnonce='+ctx.nonce, {
        method: 'POST',
      })
      .then(res=>res.json())
      .then(res=>{
        temp['toast'] = res // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
      })
    }

    async function getWishlist(){
      return await fetch(ctx.root+'blazee/v1/wishlist?_wpnonce='+ctx.nonce)
      .then(res=>res.json())
      .then(res=>{
        app.wishlist =  res
        return app.wishlist
      })
    }


    async function applyCoupon(code){
      return await fetch(ctx.root+'wc/store/cart/apply-coupon?code='+code, {
        method: 'POST',
        headers: {
          'Nonce': ctx.nonceWoo
        }
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = res // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }


    async function removeCoupon(code){
      return await fetch(ctx.root+'wc/store/v1/cart/remove-coupon?code='+code, {
        method: 'POST',
        headers: {
          'Nonce': ctx.nonceWoo
        }
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = res // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }

    async function addComment(id){
      await fetch(ctx.root+'blazee/v1/wishlist/'+id+'?_wpnonce='+ctx.nonce, {
        method: 'POST',
      })
      .then(res=>res.json())
      .then(res=>{
        temp['toast'] = res // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
      })
    }


    async function addReview(id){
      await fetch(ctx.root+'blazee/v1/wishlist/'+id+'?_wpnonce='+ctx.nonce, {
        method: 'POST',
      })
      .then(res=>res.json())
      .then(res=>{
        temp['toast'] = res // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
      })
    }

    function shareTo(platform){
      let url = ''
      if(platform=='wa') url = 'whatsapp://send?text='+location.href
      else if(platform=='fb') url = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(location.href)
      else if(platform=='x') url = 'http://twitter.com/share?url='+location.href
      else if(platform=='telegram') url = 'https://telegram.me/share/url?url='+location.href
      window.open(url , '_blank');
    }

    async function updateCartItem(key, quantity){
      return await fetch(ctx.root+'wc/store/cart/update-item?key='+key+'&amp;quantity='+quantity, {
        method: 'POST',
        headers: {
          'X-WC-Store-API-Nonce': ctx.nonceWoo,
          'Content-type': 'application/json'
        },
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = {message:'Cart Updated', type:'success'} // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }

    async function removeCartItem(key){
      return await fetch(ctx.root+'wc/store/cart/remove-item?key='+key, {
        method: 'POST',
        headers: {
          'X-WC-Store-API-Nonce': ctx.nonceWoo,
          'Content-type': 'application/json'
        },
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = {message:'Cart Updated', type:'success'} // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }

    async function updateCustomer(cutomerObj){
      return await fetch(ctx.root+'wc/store/cart/update-customer', {
        method: 'POST',
        body:JSON.stringify(customerObj),
        headers: {
          'Nonce': ctx.nonceWoo,
          'Content-type': 'application/json'
        }
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = {message:'Customer Upadate Success', type:'success'} // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }

    async function selectShippingRate(package_id, rate_id){
      return await fetch(ctx.root+'wc/store/cart/select-shipping-rate?package_id='+package_id+'&amp;rate_id='+rate_id, {
        method: 'POST',
        headers: {
          'Nonce': ctx.nonceWoo,
          'Content-type': 'application/json'
        }
      })
      .then(res=>res.json())
      .then(res=>{
        app.cart = res
        temp['toast'] = {message:'Shipping Rate Selected', type:'success'} // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return app.cart
      })
    }

    async function checkout(payment_method, payment_data, customer_note){
      return await fetch(ctx.root+'wc/store/checkout', {
        method: 'POST',
        body: JSON.stringify({
          payment_method: payment_method,
          payment_data: payment_data,
          customer_note: customer_note,
        }),
        headers: {
          'Nonce': ctx.nonceWoo,
          'Content-type': 'application/json'
        }
      })
      .then(res=>res.json())
      .then(res=>{
        temp['toast'] = {message:'Checkout Success', type:'success'} // show toast
        setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
        return res
      })
    }


    function prepare(id, demo){
      if(!data[id]) data[id] = {}
      temp[id]= updateObj(demo, data[id])
      temp[id].showForm = false
      temp[id].saving = false
    }

    function reset(id, demo){
      temp[id]=updateObj(demo)
      temp[id].showForm = true
    }

    async function idToPost(id){
      let res = await getPost(post)
      return [res]
    }

    async function idToProduct(id){
      let res = await getProduct(id)
      return [res]
    }



    function title (post){
      return post.title.rendered
    }
    function content (post){
      return post.content.rendered
    }
    function excerpt(post) {
      return post.excerpt.rendered
    }
    function permalink(post) {
      return post.link
    }
    function type(post){
      return post.type
    }
    function year (post){
      return new Date(post.date).getFullYear()
    }
    function month(post){
      return new Date(post.date).getMonth()+1
    }
    function monthName(post){
      return new Date(post.date).toLocaleString('default', { month: 'long' });
    }
    function date(post){
      return new Date(post.date).getDate()
    }
    function archiveYearLink (post){
      return post.archive_year_link
    }
    function archiveMonthLink (post){
      return post.archive_month_link
    }
    function categories (post){
      return post._embedded &amp;&amp; post._embedded['wp:term'][0]
    }
    function terms (post){
      return post._embedded &amp;&amp; post._embedded['wp:term']
    }
    function media (post){
      return (post._embedded['wp:featuredmedia'] &amp;&amp; post._embedded['wp:featuredmedia'][0]?.source_url) ?? ''
    }
    function medium (post){
      return (post._embedded['wp:featuredmedia'] &amp;&amp; post._embedded['wp:featuredmedia'][0].media_details.sizes.medium.source_url) ?? ''
    }
    function authorLink (post){
      return post._embedded?.author[0]?.link
    }
    function authorName (post){
      return post._embedded?.author[0]?.name
    }
    function view(post){
      return post.metadata?.view?.join() ?? '0'
    }
    function like(post){
      return post.metadata?.like?.join() ?? '0'
    }
    function comment(post){
      return post.metadata?.comment?.join() ?? '0'
    }
    function share(post){
      return post.metadata?.share?.join() ?? '0'
    }


    let woo = {
      name: (product)=>{
        return product.name 
      },
      description: (product)=>{
        return product.description 
      },
      short_description: (product)=>{
        return product.short_description 
      },
      images: (product)=>{
        return product.images.map(item=>item.src)
      },
      price:(product)=>{
        return product.price_html
      }
    }



    // util

    function show(el){
      gsap.from(el.querySelectorAll('[stagger]'), { opacity:0, x:0, y:50, stagger:.2 })
      el.classList.remove('invisible')
    }

    function showFast(el){
      gsap.from(el.querySelectorAll('[stagger]'), { opacity:0, x:0, y:50, stagger:.05 })
      el.classList.remove('invisible')
    }

    function  typist(el){
      let text = el.innerHTML;
      el.innerHTML = ''
      new Typed(el, {
        strings: text.split(','),
        typeSpeed: 50,
        backSpeed: 25,
        loop: true,
        startDelay: 1000,
        backDelay: 2000,
      });
    }

    function moveable(el) {
      Draggable.create(el, {
          dragClickables: false
      });

      // resizeable
      var handle = document.createElement('div')
      handle.classList.add('w-[20px]','h-[20px]','text-slate-500', 'absolute', 'bottom-0', 'right-0')
      handle.innerHTML=`<i class="ri-expand-diagonal-2-line"></i>`
      el.append(handle)
      
      Draggable.create(handle, {
        type:"top,left",
        cursor: 'nwse-resize',
        onPress: function(e) {
          e.stopPropagation(); 
        },
        onDrag: function(e) {
          TweenLite.set(this.target.parentNode, { width: this.x+20, height: this.y+20 });
        }
      });

    }

    async function activateTheme(name){
      temp['setting'].activating = true
      let res = await fetch(ctx.root+'blazee/v1/activate-theme/'+name+'?_wpnonce='+ctx.nonce).then(res=>res.json())
      temp['toast'] = res // show toast
      setTimeout(()=> delete temp['toast'], 1500 )  // hide toast
      temp['setting'].activating = false
    }

    function openMediaPicker() {
      return new Promise(resolve=>{
        let frame = wp.media({
            multiple: false
        });

        frame.on('select', function () {
            let attachment = frame.state().get('selection').first().toJSON();
            resolve(attachment.url);
        });

        frame.open();
      })
    }

    function urlToTemplate(url){

      if(location.href.startsWith(ctx.home+'section')){
        let paths = new URL(location.href).pathname.split('/')
        let sectionName = paths[paths.length-1]
        return sectionName.split(',')
      }

      let templateKey = urlToTemplateKey(url)
      if(!(templateKey  in app.theme)) templateKey='home'
      return app.theme[templateKey]
    }

    function urlToTemplateKey(url) {
      url          = new URL(url)
      let href     = url.href
      let origin   = url.origin
      let pathname = url.pathname
      let paths    = url.pathname.split('/')
      let params   = new URLSearchParams(url.search);
      let key      = paths[paths.length-1] || paths[paths.length-2]
      let home     = ctx.home.slice(0, -1)

      if(params.get('s')) return  'search'
      else if(href.replace(ctx.home, '').startsWith('search/')) return  'search'
      else if(origin+pathname==ctx.home || origin+pathname==home) return 'home'
      else if(key in app.theme) return key
      for(const post of posts){
        if(post.sku){
          if(post.permalink==href) return 'product'
          else if(post.categories.length){
            for(const item of post.categories){
              if(item.link==href) return 'shop'
            }
          } 
          else if(post.tags.length){
            for(const item of post.tags){
              if(item.link==href) return 'shop'
            }
          }
        }else{
          if(permalink(post)==href || permalink(post)==href+'/') return  type(post)=='post' ? 'single' : type(post)
          else if(archiveYearLink(post)==href) return  'archive'
          else if(archiveMonthLink(post)==href) return  'archive'
          else if(authorLink(post)==href) return  'archive'
          else if(terms(post)?.length){
            for (const item of terms(post)){
              if(item.length<1) continue;
              for(const item2 of item){
                if(item2.link==href) return 'archive'
              }
            }
          }
        }
      }
      if('404' in app.theme) return '404'
      else return 'home'
    }


    function humanize(str) {
      return str
        .replace(/^[\s_]+|[\s_]+$/g, '')
        .replace(/[_\s]+/g, ' ')
        .replace(/^[a-z]/, function(m) { return m.toUpperCase(); });
    }

    function clone(objOrArray) {
        if (Array.isArray(objOrArray)) {
            // Jika objek yang diberikan adalah array
            return objOrArray.slice(); // Menggunakan slice untuk membuat salinan array
        } else if (typeof objOrArray === 'object' &amp;&amp; objOrArray !== null) {
            // Jika objek yang diberikan adalah objek
            let clonedObj = {};
            for (let key in objOrArray) {
                if (objOrArray.hasOwnProperty(key)) {
                    clonedObj[key] = clone(objOrArray[key]); // Rekursif klona setiap properti objek
                }
            }
            return clonedObj;
        } else {
            // Jika parameter yang diberikan bukan objek atau array, maka kembalikan nilainya
            return objOrArray;
        }
    }


    function updateObj(...objs) {
      // get first obj
      let obj1 = clone(objs[0]);

      // if only one argument is passed, return it
      if (objs.length === 1) return obj1

      // update first obj with next obj
      for (const obj of objs.slice(1)) {
        if (Array.isArray(obj)) {
          obj1 = obj1.slice(0, obj.length);
          obj.forEach((value, index) => {
            let type = '';
            if (Array.isArray(value)) type = [];
            else if (typeof value === 'object') type = {};
            obj1[index] = updateObj(obj1[index] || type, value);
          });

          // delete empty objects in the array
          obj1 = obj1.filter((item) => {
            if (typeof item === 'object' &amp;&amp; !Array.isArray(item) &amp;&amp; Object.keys(item).length === 0) {
              return false;
            } else {
              return true;
            }
          });
        } else if (typeof obj === 'object') {
          for (const key in obj) {
            // if (obj1.hasOwnProperty(key)) {
              obj1[key] = updateObj(obj1[key], obj[key]);
            // }
          }
        } else {
          obj1 = obj;
        }
      }

      // return first obj
      return obj1;
    }
